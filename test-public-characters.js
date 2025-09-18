#!/usr/bin/env node

/**
 * 测试公用角色卡API端点修复
 * 这个脚本会验证所有主要的API端点是否正确配置
 */

const fs = require('fs');
const path = require('path');

console.log('=== SillyTavern 公用角色卡功能修复验证 ===\n');

// 检查文件是否存在
function checkFileExists(filePath, description) {
    const exists = fs.existsSync(filePath);
    console.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
    return exists;
}

// 检查JavaScript文件语法
function checkJSSyntax(filePath, description) {
    try {
        require(filePath);
        console.log(`✅ ${description}: 语法正确`);
        return true;
    } catch (error) {
        console.log(`❌ ${description}: 语法错误 - ${error.message}`);
        return false;
    }
}

// 检查API端点配置
function checkAPIEndpoints() {
    console.log('\n🔍 检查API端点配置:');

    const publicCharactersJS = fs.readFileSync(
        path.join(__dirname, 'public/scripts/public-characters.js'),
        'utf8'
    );

    const endpoints = [
        { pattern: "fetch\\('/api/public-characters/'", method: 'GET', desc: '获取角色卡列表' },
        { pattern: "fetch\\(`/api/public-characters/\\$\\{characterName\\}`", method: 'GET', desc: '获取角色卡详情' },
        { pattern: "fetch\\(`/api/public-characters/\\$\\{characterName\\}`", method: 'DELETE', desc: '删除角色卡' },
        { pattern: "fetch\\(`/api/public-characters/\\$\\{characterName\\}/import`", method: 'POST', desc: '导入角色卡' },
        { pattern: "fetch\\('/api/public-characters/upload'", method: 'POST', desc: '上传角色卡' }
    ];

    endpoints.forEach(endpoint => {
        const regex = new RegExp(`${endpoint.pattern}[^\\n]*method: ['"]${endpoint.method}['"]`);
        const found = regex.test(publicCharactersJS);
        console.log(`${found ? '✅' : '❌'} ${endpoint.desc}: ${endpoint.method} ${endpoint.pattern.replace('\\\\', '')}`);
    });
}

// 检查数据字段映射
function checkDataFieldMapping() {
    console.log('\n🔍 检查数据字段映射:');

    const publicCharactersJS = fs.readFileSync(
        path.join(__dirname, 'public/scripts/public-characters.js'),
        'utf8'
    );

    const mappings = [
        { pattern: 'character\\.uploader\\?\\.name', desc: '上传者名称' },
        { pattern: 'character\\.uploader\\?\\.handle', desc: '上传者handle' },
        { pattern: 'character\\.uploaded_at', desc: '上传时间' },
        { pattern: 'character\\.date_added', desc: '添加时间' }
    ];

    mappings.forEach(mapping => {
        const found = publicCharactersJS.includes(mapping.pattern);
        console.log(`${found ? '✅' : '❌'} ${mapping.desc}: ${mapping.pattern}`);
    });
}

// 检查权限控制
function checkPermissionControl() {
    console.log('\n🔍 检查权限控制:');

    const publicCharactersJS = fs.readFileSync(
        path.join(__dirname, 'public/scripts/public-characters.js'),
        'utf8'
    );

    const permissions = [
        { pattern: 'isLoggedIn', desc: '登录状态检查' },
        { pattern: 'currentUser\\?\\.admin', desc: '管理员权限检查' },
        { pattern: 'character\\.uploader\\?\\.handle === currentUser\\?\\.handle', desc: '上传者权限检查' },
        { pattern: 'canDelete', desc: '删除权限变量' }
    ];

    permissions.forEach(permission => {
        const found = publicCharactersJS.includes(permission.pattern);
        console.log(`${found ? '✅' : '❌'} ${permission.desc}: ${permission.pattern}`);
    });
}

// 主要验证流程
function main() {
    console.log('🚀 开始验证修复结果...\n');

    // 检查关键文件
    console.log('📁 检查关键文件:');
    const files = [
        { path: 'public/public-characters.html', desc: '公用角色卡页面' },
        { path: 'public/scripts/public-characters.js', desc: '公用角色卡脚本' },
        { path: 'src/endpoints/public-characters.js', desc: '后端API端点' },
        { path: 'src/character-card-parser.js', desc: 'PNG角色卡解析器' }
    ];

    files.forEach(file => {
        checkFileExists(path.join(__dirname, file.path), file.desc);
    });

    // 检查JavaScript语法
    console.log('\n📝 检查JavaScript语法:');
    checkJSSyntax(path.join(__dirname, 'public/scripts/public-characters.js'), '公用角色卡脚本');

    // 检查API端点
    checkAPIEndpoints();

    // 检查数据字段映射
    checkDataFieldMapping();

    // 检查权限控制
    checkPermissionControl();

    console.log('\n🎯 修复验证完成!');
    console.log('\n📋 建议测试流程:');
    console.log('1. 启动SillyTavern服务器');
    console.log('2. 访问 http://127.0.0.1:8000/public-characters');
    console.log('3. 测试游客浏览功能');
    console.log('4. 登录用户账户');
    console.log('5. 测试上传PNG/JSON/YAML角色卡');
    console.log('6. 测试搜索和筛选功能');
    console.log('7. 测试角色卡导入功能');
    console.log('8. 测试角色卡删除权限');
    console.log('9. 验证导入的角色卡出现在个人角色库中');
}

if (require.main === module) {
    main();
}

module.exports = { main, checkFileExists, checkJSSyntax };