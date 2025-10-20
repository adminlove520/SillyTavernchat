// 注册页面JavaScript
let regCsrfToken = '';

async function getCsrfToken() {
    try {
        const res = await fetch('/csrf-token', { method: 'GET', credentials: 'same-origin' });
        const data = await res.json();
        regCsrfToken = data.token || '';
    } catch (_) {
        // ignore; server may have CSRF disabled
        regCsrfToken = '';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const registerForm = /** @type {HTMLFormElement} */ (document.getElementById('registerForm'));
    const errorMessage = /** @type {HTMLElement} */ (document.getElementById('errorMessage'));
    const registerButton = /** @type {HTMLButtonElement} */ (document.getElementById('registerButton'));
    const backToLoginButton = /** @type {HTMLButtonElement} */ (document.getElementById('backToLoginButton'));
    const invitationCodeGroup = /** @type {HTMLElement} */ (document.getElementById('invitationCodeGroup'));

    const userHandleInput = /** @type {HTMLInputElement} */ (document.getElementById('userHandle'));
    const displayNameInput = /** @type {HTMLInputElement} */ (document.getElementById('displayName'));
    const userPasswordInput = /** @type {HTMLInputElement} */ (document.getElementById('userPassword'));
    const confirmPasswordInput = /** @type {HTMLInputElement} */ (document.getElementById('confirmPassword'));
    const invitationCodeInput = /** @type {HTMLInputElement} */ (document.getElementById('invitationCode'));

    // 先获取CSRF Token，再检查是否需要邀请码
    await getCsrfToken();
    await checkInvitationCodeStatus();

    // 返回登录按钮事件
    backToLoginButton.addEventListener('click', function() {
        window.location.href = '/login';
    });

    // 表单提交事件
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const formData = {
            handle: userHandleInput.value.trim(),
            name: displayNameInput.value.trim(),
            password: userPasswordInput.value,
            confirmPassword: confirmPasswordInput.value,
            invitationCode: invitationCodeInput.value.trim()
        };

        // 基本验证
        if (!validateForm(formData)) {
            return;
        }

        // 提交注册请求
        submitRegistration(formData);
    });

    // 实时验证
    userHandleInput.addEventListener('input', validateHandle);
    userPasswordInput.addEventListener('input', validatePassword);
    confirmPasswordInput.addEventListener('input', validateConfirmPassword);

    async function checkInvitationCodeStatus() {
        try {
            const response = await fetch('/api/invitation-codes/status', {
                method: 'GET',
                headers: regCsrfToken ? { 'x-csrf-token': regCsrfToken } : {},
                credentials: 'same-origin',
            });
            if (!response.ok) {
                // 可能是被中间件拦截，直接退出不影响注册
                return;
            }
            const data = await response.json();
            if (data && data.enabled) {
                invitationCodeGroup.style.display = 'block';
                invitationCodeInput.required = true;
            }
        } catch (error) {
            console.error('Error checking invitation code status:', error);
        }
    }

    function validateForm(formData) {
        // 清除之前的错误消息
        hideError();

        // 检查必填字段
        if (!formData.handle || !formData.name || !formData.password || !formData.confirmPassword) {
            showError('请填写所有必填字段');
            return false;
        }

        // 验证用户名格式
        if (!/^[a-z0-9-]+$/.test(formData.handle)) {
            showError('用户名只能包含小写字母、数字和连字符');
            return false;
        }

        // 额外：限制过于随意/弱的用户名
        if (isTrivialHandle(formData.handle)) {
            showError('用户名过于简单，请使用更有辨识度的用户名');
            return false;
        }

        // 验证密码长度
        if (formData.password.length < 6) {
            showError('密码长度至少6位');
            return false;
        }

        // 验证密码确认
        if (formData.password !== formData.confirmPassword) {
            showError('两次输入的密码不一致');
            return false;
        }

        // 如果需要邀请码，检查是否填写
        if (invitationCodeGroup.style.display !== 'none' && !formData.invitationCode) {
            showError('请输入邀请码');
            return false;
        }

        return true;
    }

    function validateHandle() {
        const handle = this.value.trim();
        const input = this;

        if (!handle) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        if (!/^[a-z0-9-]+$/.test(handle) || isTrivialHandle(handle)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }
    }

    // 与后端一致的随意/弱用户名判断
    function isTrivialHandle(handle) {
        if (!handle) return true;
        const h = String(handle).toLowerCase();
        if (/^\d{3,}$/.test(h)) return true; // 纯数字且>=3
        if (/^(.)\1{2,}$/.test(h)) return true; // 同字符重复>=3
        const banned = new Set([
            '123', '1234', '12345', '123456', '000', '0000', '111', '1111',
            'qwe', 'qwer', 'qwert', 'qwerty', 'asdf', 'zxc', 'zxcv', 'zxcvb', 'qaz', 'qazwsx',
            'test', 'tester', 'testing', 'guest', 'user', 'username', 'admin', 'root', 'null', 'void',
            'abc', 'abcd', 'abcdef'
        ]);
        return banned.has(h);
    }

    function validatePassword() {
        const password = this.value;
        const input = this;

        if (!password) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        if (password.length < 6) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }

        // 同时验证确认密码
        const confirmPassword = confirmPasswordInput;
        if (confirmPassword.value) {
            validateConfirmPassword.call(confirmPassword);
        }
    }

    function validateConfirmPassword() {
        const password = userPasswordInput.value;
        const confirmPassword = this.value;
        const input = this;

        if (!confirmPassword) {
            input.classList.remove('valid', 'invalid');
            return;
        }

        if (password !== confirmPassword) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }
    }

    function submitRegistration(formData) {
        // 显示加载状态
        setLoading(true);

        fetch('/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(regCsrfToken ? { 'x-csrf-token': regCsrfToken } : {}),
            },
            body: JSON.stringify(formData)
        })
        .then(async (response) => {
            if (!response.ok) {
                try {
                    const data = await response.json();
                    throw new Error(data.error || '注册失败');
                } catch (_) {
                    const text = await response.text();
                    throw new Error(text || '注册失败');
                }
            }
            return response.json();
        })
        .then(data => {
            // 注册成功，跳转到登录页面
            showSuccess('注册成功！正在跳转到登录页面...');
            setTimeout(() => {
                window.location.href = '/login';
            }, 2000);
        })
        .catch(error => {
            console.error('Registration error:', error);
            showError(error.message || '注册失败，请稍后重试');
        })
        .finally(() => {
            setLoading(false);
        });
    }

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        errorMessage.style.background = 'rgba(220, 53, 69, 0.1)';
        errorMessage.style.borderColor = 'rgba(220, 53, 69, 0.3)';
        errorMessage.style.color = '#721c24';
    }

    function showSuccess(message) {
        errorMessage.textContent = message;
        errorMessage.classList.add('show');
        errorMessage.style.background = 'rgba(40, 167, 69, 0.1)';
        errorMessage.style.borderColor = 'rgba(40, 167, 69, 0.3)';
        errorMessage.style.color = '#155724';
    }

    function hideError() {
        errorMessage.classList.remove('show');
    }

    function setLoading(loading) {
        if (loading) {
            registerButton.classList.add('loading');
            registerButton.disabled = true;
            registerButton.textContent = '注册中...';
        } else {
            registerButton.classList.remove('loading');
            registerButton.disabled = false;
            registerButton.textContent = '创建账户';
        }
    }
});
