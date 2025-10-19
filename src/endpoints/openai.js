import fs from 'node:fs';
import { Buffer } from 'node:buffer';

import fetch from 'node-fetch';
import FormData from 'form-data';
import express from 'express';

import { getConfigValue, mergeObjectWithYaml, excludeKeysByYaml, trimV1 } from '../util.js';
import { setAdditionalHeaders } from '../additional-headers.js';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { AIMLAPI_HEADERS, OPENROUTER_HEADERS } from '../constants.js';

export const router = express.Router();

router.post('/caption-image', async (request, response) => {
    try {
        let key = '';
        let headers = {};
        let bodyParams = {};

        if (request.body.api === 'openai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        }

        if (request.body.api === 'xai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.XAI);
        }

        if (request.body.api === 'mistral' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.MISTRALAI);
        }

        if (request.body.reverse_proxy && request.body.proxy_password) {
            key = request.body.proxy_password;
        }

        if (request.body.api === 'custom') {
            key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
            mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
            mergeObjectWithYaml(headers, request.body.custom_include_headers);
        }

        if (request.body.api === 'openrouter') {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        }

        if (request.body.api === 'ooba') {
            key = readSecret(request.user.directories, SECRET_KEYS.OOBA);
            bodyParams.temperature = 0.1;
        }

        if (request.body.api === 'koboldcpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.KOBOLDCPP);
        }

        if (request.body.api === 'llamacpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.LLAMACPP);
        }

        if (request.body.api === 'vllm') {
            key = readSecret(request.user.directories, SECRET_KEYS.VLLM);
        }

        if (request.body.api === 'aimlapi') {
            key = readSecret(request.user.directories, SECRET_KEYS.AIMLAPI);
        }

        if (request.body.api === 'groq') {
            key = readSecret(request.user.directories, SECRET_KEYS.GROQ);
        }

        if (request.body.api === 'cohere') {
            key = readSecret(request.user.directories, SECRET_KEYS.COHERE);
        }

        if (request.body.api === 'moonshot') {
            key = readSecret(request.user.directories, SECRET_KEYS.MOONSHOT);
        }

        if (request.body.api === 'nanogpt') {
            key = readSecret(request.user.directories, SECRET_KEYS.NANOGPT);
        }

        if (request.body.api === 'electronhub') {
            key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);
        }

        const noKeyTypes = ['custom', 'ooba', 'koboldcpp', 'vllm', 'llamacpp', 'pollinations'];
        if (!key && !request.body.reverse_proxy && !noKeyTypes.includes(request.body.api)) {
            console.warn('No key found for API', request.body.api);
            return response.sendStatus(400);
        }

        const body = {
            model: request.body.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: request.body.prompt },
                        { type: 'image_url', image_url: { 'url': request.body.image } },
                    ],
                },
            ],
            ...bodyParams,
        };

        const captionSystemPrompt = getConfigValue('openai.captionSystemPrompt');
        if (captionSystemPrompt) {
            body.messages.unshift({
                role: 'system',
                content: captionSystemPrompt,
            });
        }

        if (request.body.api === 'custom') {
            excludeKeysByYaml(body, request.body.custom_exclude_body);
        }

        let apiUrl = '';

        if (request.body.api === 'openrouter') {
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            Object.assign(headers, OPENROUTER_HEADERS);
        }

        if (request.body.api === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        }

        if (request.body.reverse_proxy) {
            apiUrl = `${request.body.reverse_proxy}/chat/completions`;
        }

        if (request.body.api === 'custom') {
            apiUrl = `${request.body.server_url}/chat/completions`;
        }

        if (request.body.api === 'aimlapi') {
            apiUrl = 'https://api.aimlapi.com/v1/chat/completions';
            Object.assign(headers, AIMLAPI_HEADERS);
        }

        if (request.body.api === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            if (body.messages?.[0]?.role === 'system') {
                body.messages[0].role = 'user';
            }
        }

        if (request.body.api === 'mistral') {
            apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        }

        if (request.body.api === 'cohere') {
            apiUrl = 'https://api.cohere.ai/v2/chat';
        }

        if (request.body.api === 'xai') {
            apiUrl = 'https://api.x.ai/v1/chat/completions';
        }

        if (request.body.api === 'pollinations') {
            headers = { Authorization: '' };
            apiUrl = 'https://text.pollinations.ai/openai/chat/completions';
        }

        if (request.body.api === 'moonshot') {
            apiUrl = 'https://api.moonshot.ai/v1/chat/completions';
        }

        if (request.body.api === 'nanogpt') {
            apiUrl = 'https://nano-gpt.com/api/v1/chat/completions';
        }

        if (request.body.api === 'electronhub') {
            apiUrl = 'https://api.electronhub.ai/v1/chat/completions';
        }

        if (['koboldcpp', 'vllm', 'llamacpp', 'ooba'].includes(request.body.api)) {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
        }

        if (request.body.api === 'ooba') {
            const imgMessage = body.messages.pop();
            body.messages.push({
                role: 'user',
                content: imgMessage?.content?.[0]?.text,
            });
            body.messages.push({
                role: 'user',
                content: [],
                image_url: imgMessage?.content?.[1]?.image_url?.url,
            });
        }

        setAdditionalHeaders(request, { headers }, apiUrl);
        console.debug('Multimodal captioning request', body);

        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
                ...headers,
            },
            body: JSON.stringify(body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Multimodal captioning request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const data = await result.json();
        console.info('Multimodal captioning response', data);
        const caption = data?.choices?.[0]?.message?.content ?? data?.message?.content?.[0]?.text;

        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    }
    catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

router.post('/transcribe-audio', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        if (!request.file) {
            console.warn('No audio file found');
            return response.sendStatus(400);
        }

        const formData = new FormData();
        console.info('Processing audio file', request.file.path);
        formData.append('file', fs.createReadStream(request.file.path), { filename: 'audio.wav', contentType: 'audio/wav' });
        formData.append('model', request.body.model);

        if (request.body.language) {
            formData.append('language', request.body.language);
        }

        const result = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        fs.unlinkSync(request.file.path);
        const data = await result.json();
        console.debug('OpenAI transcription response', data);
        return response.json(data);
    } catch (error) {
        console.error('OpenAI transcription failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        const requestBody = {
            input: request.body.text,
            response_format: 'mp3',
            voice: request.body.voice ?? 'alloy',
            speed: request.body.speed ?? 1,
            model: request.body.model ?? 'tts-1',
        };

        if (request.body.instructions) {
            requestBody.instructions = request.body.instructions;
        }

        console.debug('OpenAI TTS request', requestBody);

        const result = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('OpenAI TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

// ElectronHub TTS proxy
router.post('/electronhub/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('No ElectronHub key found');
            return response.sendStatus(400);
        }

        const requestBody = {
            input: request.body.input,
            voice: request.body.voice,
            speed: request.body.speed ?? 1,
            temperature: request.body.temperature ?? undefined,
            model: request.body.model || 'tts-1',
            response_format: 'mp3',
        };

        // Optional provider-specific params
        if (request.body.instructions) requestBody.instructions = request.body.instructions;
        if (request.body.speaker_transcript) requestBody.speaker_transcript = request.body.speaker_transcript;
        if (Number.isFinite(request.body.cfg_scale)) requestBody.cfg_scale = Number(request.body.cfg_scale);
        if (Number.isFinite(request.body.cfg_filter_top_k)) requestBody.cfg_filter_top_k = Number(request.body.cfg_filter_top_k);
        if (Number.isFinite(request.body.speech_rate)) requestBody.speech_rate = Number(request.body.speech_rate);
        if (Number.isFinite(request.body.pitch_adjustment)) requestBody.pitch_adjustment = Number(request.body.pitch_adjustment);
        if (request.body.emotional_style) requestBody.emotional_style = request.body.emotional_style;

        // Handle dynamic parameters sent from the frontend
        const knownParams = new Set(Object.keys(requestBody));
        for (const key in request.body) {
            if (!knownParams.has(key) && request.body[key] !== undefined) {
                requestBody[key] = request.body[key];
            }
        }

        // Clean undefineds
        Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k]);

        console.debug('ElectronHub TTS request', requestBody);

        const result = await fetch('https://api.electronhub.ai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('ElectronHub TTS request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const contentType = result.headers.get('content-type') || 'audio/mpeg';
        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', contentType);
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('ElectronHub TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

// ElectronHub model list
router.post('/electronhub/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('No ElectronHub key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://api.electronhub.ai/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('ElectronHub models request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        const models = data && Array.isArray(data['data']) ? data['data'] : [];
        return response.json(models);
    } catch (error) {
        console.error('ElectronHub models fetch failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-image', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        console.debug('OpenAI request', request.body);

        const result = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(request.body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        return response.json(data);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

const custom = express.Router();

custom.post('/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM_OPENAI_TTS);
        const { input, provider_endpoint, response_format, voice, speed, model } = request.body;

        if (!provider_endpoint) {
            console.warn('No OpenAI-compatible TTS provider endpoint provided');
            return response.sendStatus(400);
        }

        const result = await fetch(provider_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key ?? ''}`,
            },
            body: JSON.stringify({
                input: input ?? '',
                response_format: response_format ?? 'mp3',
                voice: voice ?? 'alloy',
                speed: speed ?? 1,
                model: model ?? 'tts-1',
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('OpenAI TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

router.use('/custom', custom);
