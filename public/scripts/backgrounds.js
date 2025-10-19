import { Fuse, localforage } from '../lib.js';
import { chat_metadata, eventSource, event_types, generateQuietPrompt, getCurrentChatId, getRequestHeaders, getThumbnailUrl, saveSettingsDebounced } from '../script.js';
import { openThirdPartyExtensionMenu, saveMetadataDebounced } from './extensions.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { createThumbnail, flashHighlight, getBase64Async, stringFormat, debounce, setupScrollToTop } from './utils.js';
import { debounce_timeout } from './constants.js';
import { t } from './i18n.js';
import { Popup } from './popup.js';

const BG_METADATA_KEY = 'custom_background';
const LIST_METADATA_KEY = 'chat_backgrounds';

// A single transparent PNG pixel used as a placeholder for errored backgrounds
const PNG_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const PNG_PIXEL_BLOB = new Blob([Uint8Array.from(atob(PNG_PIXEL), c => c.charCodeAt(0))], { type: 'image/png' });
const PLACEHOLDER_IMAGE = `url('data:image/png;base64,${PNG_PIXEL}')`;

const THUMBNAIL_COLUMNS_MIN = 2;
const THUMBNAIL_COLUMNS_MAX = 8;
const THUMBNAIL_COLUMNS_DEFAULT_DESKTOP = 5;
const THUMBNAIL_COLUMNS_DEFAULT_MOBILE = 3;

/**
 * Storage for frontend-generated background thumbnails.
 * This is used to store thumbnails for backgrounds that cannot be generated on the server.
 */
const THUMBNAIL_STORAGE = localforage.createInstance({ name: 'SillyTavern_Thumbnails' });

/**
 * Cache for thumbnail blob URLs.
 * @type {Map<string, string>}
 */
const THUMBNAIL_BLOBS = new Map();

const THUMBNAIL_CONFIG = {
    width: 160,
    height: 90,
};

/**
 * Global IntersectionObserver instance for lazy loading backgrounds
 * @type {IntersectionObserver|null}
 */
let lazyLoadObserver = null;

export let background_settings = {
    name: '__transparent.png',
    url: generateUrlParameter('__transparent.png', false),
    fitting: 'classic',
    animation: false,
};

/**
 * Creates a single thumbnail DOM element. The CSS now handles all sizing.
 * @param {object} imageData - Data for the image (filename, isCustom).
 * @returns {HTMLElement} The created thumbnail element.
 */
function createThumbnailElement(imageData) {
    const bg = imageData.filename;
    const isCustom = imageData.isCustom;

    const thumbnail = $('#background_template .bg_example').clone();

    const clipper = document.createElement('div');
    clipper.className = 'thumbnail-clipper lazy-load-background';
    clipper.style.backgroundImage = PLACEHOLDER_IMAGE;

    const titleElement = thumbnail.find('.BGSampleTitle');
    clipper.appendChild(titleElement.get(0));
    thumbnail.append(clipper);

    const url = generateUrlParameter(bg, isCustom);
    const title = isCustom ? bg.split('/').pop() : bg;
    const friendlyTitle = title.slice(0, title.lastIndexOf('.'));

    thumbnail.attr('title', title);
    thumbnail.attr('bgfile', bg);
    thumbnail.attr('custom', String(isCustom));
    thumbnail.data('url', url);
    titleElement.text(friendlyTitle);

    return thumbnail.get(0);
}

/**
 * Applies the thumbnail column count to the CSS and updates button states.
 * @param {number} count - The number of columns to display.
 */
function applyThumbnailColumns(count) {
    const newCount = Math.max(THUMBNAIL_COLUMNS_MIN, Math.min(count, THUMBNAIL_COLUMNS_MAX));
    background_settings.thumbnailColumns = newCount;
    document.documentElement.style.setProperty('--bg-thumb-columns', newCount.toString());

    $('#bg_thumb_zoom_in').prop('disabled', newCount <= THUMBNAIL_COLUMNS_MIN);
    $('#bg_thumb_zoom_out').prop('disabled', newCount >= THUMBNAIL_COLUMNS_MAX);

    saveSettingsDebounced();
}

export function loadBackgroundSettings(settings) {
    let backgroundSettings = settings.background;
    if (!backgroundSettings || !backgroundSettings.name || !backgroundSettings.url) {
        backgroundSettings = background_settings;
    }
    if (!backgroundSettings.fitting) {
        backgroundSettings.fitting = 'classic';
    }
    if (!Object.hasOwn(backgroundSettings, 'animation')) {
        backgroundSettings.animation = false;
    }

    // If a value is already saved, use it. Otherwise, determine default based on screen size.
    let columns = backgroundSettings.thumbnailColumns;
    if (!columns) {
        const isNarrowScreen = window.matchMedia('(max-width: 480px)').matches;
        columns = isNarrowScreen ? THUMBNAIL_COLUMNS_DEFAULT_MOBILE : THUMBNAIL_COLUMNS_DEFAULT_DESKTOP;
    }
    background_settings.thumbnailColumns = columns;
    applyThumbnailColumns(background_settings.thumbnailColumns);

    setBackground(backgroundSettings.name, backgroundSettings.url);
    setFittingClass(backgroundSettings.fitting);
    $('#background_fitting').val(backgroundSettings.fitting);
    $('#background_thumbnails_animation').prop('checked', background_settings.animation);
    highlightSelectedBackground();
}

/**
 * Sets the background for the current chat and adds it to the list of custom backgrounds.
 * @param {{url: string, path:string}} backgroundInfo
 */
async function forceSetBackground(backgroundInfo) {
    saveBackgroundMetadata(backgroundInfo.url);
    $('#bg1').css('background-image', backgroundInfo.url);

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const bg = backgroundInfo.path;
    list.push(bg);
    chat_metadata[LIST_METADATA_KEY] = list;
    saveMetadataDebounced();
    renderChatBackgrounds();
    highlightNewBackground(bg);
    highlightLockedBackground();
}

async function onChatChanged() {
    const lockedUrl = chat_metadata[BG_METADATA_KEY];

    $('#bg1').css('background-image', lockedUrl || background_settings.url);

    renderChatBackgrounds();
    highlightLockedBackground();
    highlightSelectedBackground();
}

function getBackgroundPath(fileUrl) {
    return `backgrounds/${encodeURIComponent(fileUrl)}`;
}

function highlightLockedBackground() {
    $('.bg_example.locked-background').removeClass('locked-background');

    const lockedBackgroundUrl = chat_metadata[BG_METADATA_KEY];

    if (lockedBackgroundUrl) {
        $('.bg_example').filter(function () {
            return $(this).data('url') === lockedBackgroundUrl;
        }).addClass('locked-background');
    }
}

/**
 * Locks the background for the current chat
 * @param {Event|null} event
 */
function onLockBackgroundClick(event = null) {
    if (!getCurrentChatId()) {
        toastr.warning(t`Select a chat to lock the background for it`);
        return;
    }

    // Take the global background's URL and save it to the chat's metadata.
    const urlToLock = event ? $(event.target).closest('.bg_example').data('url') : background_settings.url;
    saveBackgroundMetadata(urlToLock);
    $('#bg1').css('background-image', urlToLock);

    // Update UI states to reflect the new lock.
    highlightLockedBackground();
}

/**
 * Unlocks the background for the current chat
 * @param {Event|null} _event
 */
function onUnlockBackgroundClick(_event = null) {
    // Delete the lock from the chat's metadata.
    removeBackgroundMetadata();

    // Revert the view to the current global background.
    $('#bg1').css('background-image', background_settings.url);

    // Update UI states to reflect the removal of the lock.
    highlightLockedBackground();
    highlightSelectedBackground();
}

function isChatBackgroundLocked() {
    return chat_metadata[BG_METADATA_KEY];
}

function saveBackgroundMetadata(file) {
    chat_metadata[BG_METADATA_KEY] = file;
    saveMetadataDebounced();
}

function removeBackgroundMetadata() {
    delete chat_metadata[BG_METADATA_KEY];
    saveMetadataDebounced();
}

function onSelectBackgroundClick() {
    const bgFile = $(this).attr('bgfile');
    const backgroundCssUrl = getUrlParameter(this);

    if (isChatBackgroundLocked()) {
        // If a background is locked, update the locked background directly
        saveBackgroundMetadata(backgroundCssUrl);
        $('#bg1').css('background-image', backgroundCssUrl);
        highlightLockedBackground();
    } else {
        // Otherwise, update the global background setting
        setBackground(bgFile, backgroundCssUrl);
    }

    // Update UI highlights to reflect the changes.
    highlightSelectedBackground();
}

async function onCopyToSystemBackgroundClick(e) {
    e.stopPropagation();
    const bgNames = await getNewBackgroundName(this);

    if (!bgNames) {
        return;
    }

    const bgFile = await fetch(bgNames.oldBg);

    if (!bgFile.ok) {
        toastr.warning('Failed to copy background');
        return;
    }

    const blob = await bgFile.blob();
    const file = new File([blob], bgNames.newBg);
    const formData = new FormData();
    formData.set('avatar', file);

    await uploadBackground(formData);

    const list = chat_metadata[LIST_METADATA_KEY] || [];
    const index = list.indexOf(bgNames.oldBg);
    list.splice(index, 1);
    saveMetadataDebounced();
    renderChatBackgrounds();
}

/**
 * Gets a thumbnail for the background from storage or fetches it if not available.
 * It caches the thumbnail in local storage and returns a blob URL for the thumbnail.
 * If the thumbnail cannot be fetched, it returns a transparent PNG pixel as a fallback.
 * @param {string} bg Background URL
 * @param {boolean} isCustom Is the background custom?
 * @returns {Promise<string>} Blob URL of the thumbnail
 */
async function getThumbnailFromStorage(bg, isCustom) {
    const cachedBlobUrl = THUMBNAIL_BLOBS.get(bg);
    if (cachedBlobUrl) {
        return cachedBlobUrl;
    }

    const savedBlob = await THUMBNAIL_STORAGE.getItem(bg);
    if (savedBlob) {
        const savedBlobUrl = URL.createObjectURL(savedBlob);
        THUMBNAIL_BLOBS.set(bg, savedBlobUrl);
        return savedBlobUrl;
    }

    try {
        const url = isCustom ? bg : getBackgroundPath(bg);
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) {
            throw new Error('Fetch failed with status: ' + response.status);
        }
        const imageBlob = await response.blob();
        const imageBase64 = await getBase64Async(imageBlob);
        const thumbnailBase64 = await createThumbnail(imageBase64, THUMBNAIL_CONFIG.width, THUMBNAIL_CONFIG.height);
        const thumbnailBlob = await fetch(thumbnailBase64).then(res => res.blob());
        await THUMBNAIL_STORAGE.setItem(bg, thumbnailBlob);
        const blobUrl = URL.createObjectURL(thumbnailBlob);
        THUMBNAIL_BLOBS.set(bg, blobUrl);
        return blobUrl;
    } catch (error) {
        console.error('Error fetching thumbnail, fallback image will be used:', error);
        const fallbackBlob = PNG_PIXEL_BLOB;
        const fallbackBlobUrl = URL.createObjectURL(fallbackBlob);
        THUMBNAIL_BLOBS.set(bg, fallbackBlobUrl);
        return fallbackBlobUrl;
    }
}

/**
 * Gets the new background name from the user.
 * @param {Element} referenceElement
 * @returns {Promise<{oldBg: string, newBg: string}>}
 * */
async function getNewBackgroundName(referenceElement) {
    const exampleBlock = $(referenceElement).closest('.bg_example');
    const isCustom = exampleBlock.attr('custom') === 'true';
    const oldBg = exampleBlock.attr('bgfile');

    if (!oldBg) {
        console.debug('no bgfile');
        return;
    }

    const fileExtension = oldBg.split('.').pop();
    const fileNameBase = isCustom ? oldBg.split('/').pop() : oldBg;
    const oldBgExtensionless = fileNameBase.replace(`.${fileExtension}`, '');
    const newBgExtensionless = await Popup.show.input(t`Enter new background name:`, null, oldBgExtensionless);

    if (!newBgExtensionless) {
        console.debug('no new_bg_extensionless');
        return;
    }

    const newBg = `${newBgExtensionless}.${fileExtension}`;

    if (oldBgExtensionless === newBgExtensionless) {
        console.debug('new_bg === old_bg');
        return;
    }

    return { oldBg, newBg };
}

async function onRenameBackgroundClick(e) {
    e.stopPropagation();

    const bgNames = await getNewBackgroundName(this);

    if (!bgNames) {
        return;
    }

    const data = { old_bg: bgNames.oldBg, new_bg: bgNames.newBg };
    const response = await fetch('/api/backgrounds/rename', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(data),
        cache: 'no-cache',
    });

    if (response.ok) {
        await getBackgrounds();
        highlightNewBackground(bgNames.newBg);
    } else {
        toastr.warning('Failed to rename background');
    }
}

async function onDeleteBackgroundClick(e) {
    e.stopPropagation();
    const bgToDelete = $(this).closest('.bg_example');
    const url = bgToDelete.data('url');
    const isCustom = bgToDelete.attr('custom') === 'true';
    const confirm = await Popup.show.confirm(t`Delete the background?`, null);
    const bg = bgToDelete.attr('bgfile');

    if (confirm) {
        // If it's not custom, it's a built-in background. Delete it from the server
        if (!isCustom) {
            delBackground(bg);
        } else {
            const list = chat_metadata[LIST_METADATA_KEY] || [];
            const index = list.indexOf(bg);
            list.splice(index, 1);
        }

        if (bg === background_settings.name) {
            const siblingSelector = '.bg_example';
            const nextBg = bgToDelete.next(siblingSelector);
            const prevBg = bgToDelete.prev(siblingSelector);

            if (nextBg.length > 0) {
                nextBg.trigger('click');
            } else if (prevBg.length > 0) {
                prevBg.trigger('click');
            } else {
                const anyOtherBg = $('.bg_example').not(bgToDelete).first();
                if (anyOtherBg.length > 0) {
                    anyOtherBg.trigger('click');
                }
            }
        }

        bgToDelete.remove();

        if (url === chat_metadata[BG_METADATA_KEY]) {
            removeBackgroundMetadata();
            highlightLockedBackground();
        }

        if (isCustom) {
            renderChatBackgrounds();
            saveMetadataDebounced();
        }
    }
}

const autoBgPrompt = 'Ignore previous instructions and choose a location ONLY from the provided list that is the most suitable for the current scene. Do not output any other text:\n{0}';

async function autoBackgroundCommand() {
    /** @type {HTMLElement[]} */
    const bgTitles = Array.from(document.querySelectorAll('#bg_menu_content .BGSampleTitle'));
    const options = bgTitles.map(x => ({ element: x, text: x.innerText.trim() })).filter(x => x.text.length > 0);
    if (options.length == 0) {
        toastr.warning('No backgrounds to choose from. Please upload some images to the "backgrounds" folder.');
        return '';
    }

    const list = options.map(option => `- ${option.text}`).join('\n');
    const prompt = stringFormat(autoBgPrompt, list);
    const reply = await generateQuietPrompt({ quietPrompt: prompt });
    const fuse = new Fuse(options, { keys: ['text'] });
    const bestMatch = fuse.search(reply, { limit: 1 });

    if (bestMatch.length == 0) {
        for (const option of options) {
            if (String(reply).toLowerCase().includes(option.text.toLowerCase())) {
                console.debug('Fallback choosing background:', option);
                option.element.click();
                return '';
            }
        }

        toastr.warning('No match found. Please try again.');
        return '';
    }

    console.debug('Automatically choosing background:', bestMatch);
    bestMatch[0].item.element.click();
    return '';
}

/**
 * Renders the system backgrounds gallery.
 * @param {string[]} [backgrounds] - Optional filtered list of backgrounds.
 */
function renderSystemBackgrounds(backgrounds) {
    const sourceList = backgrounds || [];
    const container = $('#bg_menu_content');
    container.empty();

    if (sourceList.length === 0) return;

    sourceList.forEach(bg => {
        const imageData = { filename: bg, isCustom: false };
        const thumbnail = createThumbnailElement(imageData);
        container.append(thumbnail);
    });

    activateLazyLoader();
}

/**
 * Renders the chat-specific (custom) backgrounds gallery.
 * @param {string[]} [backgrounds] - Optional filtered list of backgrounds.
 */
function renderChatBackgrounds(backgrounds) {
    const sourceList = backgrounds ?? (chat_metadata[LIST_METADATA_KEY] || []);
    const container = $('#bg_custom_content');
    container.empty();
    $('#bg_chat_hint').toggle(!sourceList.length);

    if (sourceList.length === 0) return;

    sourceList.forEach(bg => {
        const imageData = { filename: bg, isCustom: true };
        const thumbnail = createThumbnailElement(imageData);
        container.append(thumbnail);
    });

    activateLazyLoader();
}

export async function getBackgrounds() {
    const response = await fetch('/api/backgrounds/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });
    if (response.ok) {
        const { images, config } = await response.json();
        Object.assign(THUMBNAIL_CONFIG, config);

        renderSystemBackgrounds(images);
        highlightSelectedBackground();
    }
}

function activateLazyLoader() {
    // Disconnect previous observer to prevent memory leaks
    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
        lazyLoadObserver = null;
    }

    const lazyLoadElements = document.querySelectorAll('.lazy-load-background');

    const options = {
        root: null,
        rootMargin: '200px',
        threshold: 0.01,
    };

    lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.target instanceof HTMLElement && entry.isIntersecting) {
                const clipper = entry.target;
                const parentThumbnail = clipper.closest('.bg_example');

                if (parentThumbnail) {
                    const bg = parentThumbnail.getAttribute('bgfile');
                    const isCustom = parentThumbnail.getAttribute('custom') === 'true';
                    resolveImageUrl(bg, isCustom)
                        .then(url => { clipper.style.backgroundImage = url; })
                        .catch(() => { clipper.style.backgroundImage = PLACEHOLDER_IMAGE; });
                }

                clipper.classList.remove('lazy-load-background');
                observer.unobserve(clipper);
            }
        });
    }, options);

    lazyLoadElements.forEach(element => {
        lazyLoadObserver.observe(element);
    });
}

/**
 * Gets the CSS URL of the background
 * @param {Element} block
 * @returns {string} URL of the background
 */
function getUrlParameter(block) {
    return $(block).closest('.bg_example').data('url');
}

function generateUrlParameter(bg, isCustom) {
    return isCustom ? `url("${encodeURI(bg)}")` : `url("${getBackgroundPath(bg)}")`;
}

/**
 * Resolves the image URL for the background.
 * @param {string} bg Background file name
 * @param {boolean} isCustom Is a custom background
 * @returns {Promise<string>} CSS URL of the background
 */
async function resolveImageUrl(bg, isCustom) {
    const fileExtension = bg.split('.').pop().toLowerCase();
    const isAnimated = ['mp4', 'webp'].includes(fileExtension);
    const thumbnailUrl = isAnimated && !background_settings.animation
        ? await getThumbnailFromStorage(bg, isCustom)
        : isCustom
            ? bg
            : getThumbnailUrl('bg', bg);

    return `url("${thumbnailUrl}")`;
}

async function setBackground(bg, url) {
    // Only change the visual background if one is not locked for the current chat.
    if (!isChatBackgroundLocked()) {
        $('#bg1').css('background-image', url);
    }
    background_settings.name = bg;
    background_settings.url = url;
    saveSettingsDebounced();
}

async function delBackground(bg) {
    await fetch('/api/backgrounds/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            bg: bg,
        }),
    });

    await THUMBNAIL_STORAGE.removeItem(bg);
    if (THUMBNAIL_BLOBS.has(bg)) {
        URL.revokeObjectURL(THUMBNAIL_BLOBS.get(bg));
        THUMBNAIL_BLOBS.delete(bg);
    }
}

async function onBackgroundUploadSelected() {
    const form = $('#form_bg_upload').get(0);

    if (!(form instanceof HTMLFormElement)) {
        console.error('form_bg_upload is not a form');
        return;
    }

    const formData = new FormData(form);

    const file = formData.get('avatar');
    if (!(file instanceof File) || file.size === 0) {
        form.reset();
        return;
    }

    await convertFileIfVideo(formData);
    await uploadBackground(formData);
    form.reset();
}

/**
 * Converts a video file to an animated webp format if the file is a video.
 * @param {FormData} formData
 * @returns {Promise<void>}
 */
async function convertFileIfVideo(formData) {
    const file = formData.get('avatar');
    if (!(file instanceof File)) {
        return;
    }
    if (!file.type.startsWith('video/')) {
        return;
    }
    if (typeof globalThis.convertVideoToAnimatedWebp !== 'function') {
        toastr.warning(t`Click here to install the Video Background Loader extension`, t`Video background uploads require a downloadable add-on`, {
            timeOut: 0,
            extendedTimeOut: 0,
            onclick: () => openThirdPartyExtensionMenu('https://github.com/SillyTavern/Extension-VideoBackgroundLoader'),
        });
        return;
    }

    let toastMessage = jQuery();
    try {
        toastMessage = toastr.info(t`Preparing video for upload. This may take several minutes.`, t`Please wait`, { timeOut: 0, extendedTimeOut: 0 });
        const sourceBuffer = await file.arrayBuffer();
        const convertedBuffer = await globalThis.convertVideoToAnimatedWebp({ buffer: new Uint8Array(sourceBuffer), name: file.name });
        const convertedFileName = file.name.replace(/\.[^/.]+$/, '.webp');
        const convertedFile = new File([new Uint8Array(convertedBuffer)], convertedFileName, { type: 'image/webp' });
        formData.set('avatar', convertedFile);
        toastMessage.remove();
    } catch (error) {
        formData.delete('avatar');
        toastMessage.remove();
        console.error('Error converting video to animated webp:', error);
        toastr.error(t`Error converting video to animated webp`);
    }
}

/**
 * Uploads a background to the server
 * @param {FormData} formData
 */
async function uploadBackground(formData) {
    try {
        if (!formData.has('avatar')) {
            console.log('No file provided. Background upload cancelled.');
            return;
        }

        const response = await fetch('/api/backgrounds/upload', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
            body: formData,
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error('Failed to upload background');
        }

        const bg = await response.text();
        setBackground(bg, generateUrlParameter(bg, false));
        await getBackgrounds();
        highlightNewBackground(bg);
    } catch (error) {
        console.error('Error uploading background:', error);
    }
}

/**
 * @param {string} bg
 */
function highlightNewBackground(bg) {
    const newBg = $(`.bg_example[bgfile="${bg}"]`);
    const scrollOffset = newBg.offset().top - newBg.parent().offset().top;
    $('#Backgrounds').scrollTop(scrollOffset);
    flashHighlight(newBg);
}

/**
 * Sets the fitting class for the background element
 * @param {string} fitting Fitting type
 */
function setFittingClass(fitting) {
    const backgrounds = $('#bg1');
    for (const option of ['cover', 'contain', 'stretch', 'center']) {
        backgrounds.toggleClass(option, option === fitting);
    }
    background_settings.fitting = fitting;
}

function highlightSelectedBackground() {
    $('.bg_example.selected-background').removeClass('selected-background');

    // The "selected" highlight should always reflect the global background setting.
    const activeUrl = background_settings.url;

    if (activeUrl) {
        // Find the thumbnail whose data-url attribute matches the active URL
        $('.bg_example').filter(function () {
            return $(this).data('url') === activeUrl;
        }).addClass('selected-background');
    }
}

function onBackgroundFilterInput() {
    const filterValue = String($('#bg-filter').val()).toLowerCase();
    $('#bg_menu_content > .bg_example, #bg_custom_content > .bg_example').each(function () {
        const $bg = $(this);
        const title = $bg.attr('title') || '';
        const hasMatch = title.toLowerCase().includes(filterValue);
        $bg.toggle(hasMatch);
    });
}

const debouncedOnBackgroundFilterInput = debounce(onBackgroundFilterInput, debounce_timeout.standard);

export function initBackgrounds() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.FORCE_SET_BACKGROUND, forceSetBackground);

    $(document)
        .off('click', '.bg_example').on('click', '.bg_example', onSelectBackgroundClick)
        .off('click', '.bg_example .mobile-only-menu-toggle').on('click', '.bg_example .mobile-only-menu-toggle', function (e) {
            e.stopPropagation();
            const $context = $(this).closest('.bg_example');
            const wasOpen = $context.hasClass('mobile-menu-open');
            // Close all other open menus before opening a new one.
            $('.bg_example.mobile-menu-open').removeClass('mobile-menu-open');
            if (!wasOpen) {
                $context.addClass('mobile-menu-open');
            }
        })
        .off('blur', '.bg_example.mobile-menu-open').on('blur', '.bg_example.mobile-menu-open', function () {
            if (!$(this).is(':focus-within')) {
                $(this).removeClass('mobile-menu-open');
            }
        })
        .off('click', '.jg-button').on('click', '.jg-button', function (e) {
            e.stopPropagation();
            const action = $(this).data('action');

            switch (action) {
                case 'lock':
                    onLockBackgroundClick.call(this, e.originalEvent);
                    break;
                case 'unlock':
                    onUnlockBackgroundClick.call(this, e.originalEvent);
                    break;
                case 'edit':
                    onRenameBackgroundClick.call(this, e.originalEvent);
                    break;
                case 'delete':
                    onDeleteBackgroundClick.call(this, e.originalEvent);
                    break;
                case 'copy':
                    onCopyToSystemBackgroundClick.call(this, e.originalEvent);
                    break;
            }
        });

    $('#bg_thumb_zoom_in').on('click', () => {
        applyThumbnailColumns(background_settings.thumbnailColumns - 1);
    });
    $('#bg_thumb_zoom_out').on('click', () => {
        applyThumbnailColumns(background_settings.thumbnailColumns + 1);
    });
    $('#auto_background').on('click', autoBackgroundCommand);
    $('#add_bg_button').on('change', onBackgroundUploadSelected);
    $('#bg-filter').on('input', () => debouncedOnBackgroundFilterInput());
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lockbg',
        callback: () => {
            onLockBackgroundClick();
            return '';
        },
        aliases: ['bglock'],
        helpString: 'Locks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'unlockbg',
        callback: () => {
            onUnlockBackgroundClick();
            return '';
        },
        aliases: ['bgunlock'],
        helpString: 'Unlocks a background for the currently selected chat',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'autobg',
        callback: autoBackgroundCommand,
        aliases: ['bgauto'],
        helpString: 'Automatically changes the background based on the chat context using the AI request prompt',
    }));

    $('#background_fitting').on('input', function () {
        background_settings.fitting = String($(this).val());
        setFittingClass(background_settings.fitting);
        saveSettingsDebounced();
    });

    $('#background_thumbnails_animation').on('input', async function () {
        background_settings.animation = !!$(this).prop('checked');
        saveSettingsDebounced();

        // Refresh background thumbnails
        await getBackgrounds();
        await onChatChanged();
    });

    setupScrollToTop({
        scrollContainerId: 'bg-scrollable-content',
        buttonId: 'bg-scroll-top',
        drawerId: 'Backgrounds',
    });
}
