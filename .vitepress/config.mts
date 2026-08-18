import {defineConfig} from 'vitepress'
import {glossaryPlugin} from './plugins/glossary'

// 部署子路径,通过环境变量 BASE 配置,默认根路径 /
// 部署到子路径时设置 BASE=/cloudarcade/ ;根域名部署时留空或设为 /
// 注意:必须以 / 开头、以 / 结尾
const base = process.env.BASE || '/'

export default defineConfig({
    lang: 'zh-CN',
    title: 'CloudArcade Wiki',
    description: 'CloudArcade 云游戏站 CMS 源码解析文档',
    base,
    cleanUrls: true,
    lastUpdated: true,

    head: [
        ['meta', {name: 'keywords', content: 'CloudArcade, PHP, HTML5 Games, CMS, 源码解析'}]
    ],

    markdown: {
        // Shiki 未内置 caddyfile / gitignore 语言,映射到语法相近的内置语言
        // - caddyfile → nginx(同为 web 服务器配置文件,语法结构相近)
        // - gitignore → bash(路径模式与 shell glob 相近)
        languageAlias: {
            caddyfile: 'nginx',
            gitignore: 'bash',
        },
        config(md) {
            md.use(glossaryPlugin)
        }
    },

    themeConfig: {
        logo: '/cloudarcade-logo.svg',
        nav: [
            {text: '主站', link: 'https://smartool.top/'},
            {text: '指南', link: '/guide/introduction'},
            {text: '架构', link: '/architecture/request-lifecycle'},
            {text: '核心类', link: '/classes/game'},
            {text: '接口', link: '/api/public-api'},
            {text: '后台', link: '/admin/overview'},
            {text: '主题与插件', link: '/theming/overview'},
            {text: '运维部署', link: '/devops/deploy-frankenphp'},
            {text: '术语表', link: '/glossary'}
        ],

        sidebar: {
            '/guide/': [
                {
                    text: '指南',
                    items: [
                        {text: '项目简介', link: '/guide/introduction'},
                        {text: '目录结构', link: '/guide/directory-structure'},
                        {text: '安装部署', link: '/guide/installation'},
                        {text: '配置说明', link: '/guide/configuration'}
                    ]
                }
            ],
            '/architecture/': [
                {
                    text: '架构',
                    items: [
                        {text: '请求生命周期', link: '/architecture/request-lifecycle'},
                        {text: '数据库设计', link: '/architecture/database'},
                        {text: '安全机制', link: '/architecture/security'}
                    ]
                }
            ],
            '/classes/': [
                {
                    text: '核心类',
                    items: [
                        {text: 'Game 游戏类', link: '/classes/game'},
                        {text: 'Category 分类类', link: '/classes/category'},
                        {text: 'Collection 合集类', link: '/classes/collection'},
                        {text: 'Page 页面类', link: '/classes/page'},
                        {text: 'User 用户类', link: '/classes/user'},
                        {text: 'CA_Auth 认证类', link: '/classes/auth'},
                        {text: 'Widget 小工具类', link: '/classes/widget'},
                        {text: 'SystemUpdater 更新类', link: '/classes/system-updater'}
                    ]
                }
            ],
            '/api/': [
                {
                    text: '接口',
                    items: [
                        {text: '前台 API', link: '/api/public-api'},
                        {text: '后台 AJAX', link: '/api/admin-ajax'}
                    ]
                }
            ],
            '/admin/': [
                {
                    text: '后台管理',
                    items: [
                        {text: '后台总览', link: '/admin/overview'},
                        {text: '游戏管理', link: '/admin/games'},
                        {text: '内容管理', link: '/admin/content'},
                        {text: '外观与主题', link: '/admin/appearance'},
                        {text: '插件管理', link: '/admin/plugins'}
                    ]
                }
            ],
            '/theming/': [
                {
                    text: '主题与插件',
                    items: [
                        {text: '主题系统', link: '/theming/overview'},
                        {text: '主题结构', link: '/theming/theme-structure'},
                        {text: '模板函数', link: '/theming/template-functions'},
                        {text: '插件机制', link: '/plugins/plugin-system'}
                    ]
                }
            ],
            '/plugins/': [
                {
                    text: '主题与插件',
                    items: [
                        {text: '主题系统', link: '/theming/overview'},
                        {text: '主题结构', link: '/theming/theme-structure'},
                        {text: '模板函数', link: '/theming/template-functions'},
                        {text: '插件机制', link: '/plugins/plugin-system'}
                    ]
                }
            ],
            '/devops/': [
                {
                    text: '运维部署',
                    items: [
                        {text: 'FrankenPHP 部署', link: '/devops/deploy-frankenphp'},
                        {text: '子路径部署', link: '/devops/subpath-deploy'}
                    ]
                }
            ]
        },

        footer: {
            message: '基于 CloudArcade 2.1.3 源码生成',
            copyright: 'Copyright © 2026 smartool-cloudarcade-wiki'
        },

        search: {
            provider: 'local'
        }
    }
})
