// 注册页面JavaScript
let csrfToken = '';

async function getCsrfToken() {
    try {
        const res = await fetch('/csrf-token', { method: 'GET', credentials: 'same-origin' });
        const data = await res.json();
        csrfToken = data.token || '';
    } catch (_) {
        // ignore; server may have CSRF disabled
        csrfToken = '';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    const registerForm = document.getElementById('registerForm');
    const errorMessage = document.getElementById('errorMessage');
    const registerButton = document.getElementById('registerButton');
    const backToLoginButton = document.getElementById('backToLoginButton');
    const invitationCodeGroup = document.getElementById('invitationCodeGroup');

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
            handle: document.getElementById('userHandle').value.trim(),
            name: document.getElementById('displayName').value.trim(),
            password: document.getElementById('userPassword').value,
            confirmPassword: document.getElementById('confirmPassword').value,
            invitationCode: document.getElementById('invitationCode').value.trim()
        };

        // 基本验证
        if (!validateForm(formData)) {
            return;
        }

        // 提交注册请求
        submitRegistration(formData);
    });

    // 实时验证
    document.getElementById('userHandle').addEventListener('input', validateHandle);
    document.getElementById('userPassword').addEventListener('input', validatePassword);
    document.getElementById('confirmPassword').addEventListener('input', validateConfirmPassword);

    async function checkInvitationCodeStatus() {
        try {
            const response = await fetch('/api/invitation-codes/status', {
                method: 'GET',
                headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
                credentials: 'same-origin',
            });
            if (!response.ok) {
                // 可能是被中间件拦截，直接退出不影响注册
                return;
            }
            const data = await response.json();
            if (data && data.enabled) {
                invitationCodeGroup.style.display = 'block';
                document.getElementById('invitationCode').required = true;
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

        if (!/^[a-z0-9-]+$/.test(handle)) {
            input.classList.remove('valid');
            input.classList.add('invalid');
        } else {
            input.classList.remove('invalid');
            input.classList.add('valid');
        }
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
        const confirmPassword = document.getElementById('confirmPassword');
        if (confirmPassword.value) {
            validateConfirmPassword.call(confirmPassword);
        }
    }

    function validateConfirmPassword() {
        const password = document.getElementById('userPassword').value;
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
                ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
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
