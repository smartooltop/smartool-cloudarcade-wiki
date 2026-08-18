---
layout: home

hero:
  name: CloudArcade Wiki
  text: 源码解析文档
  tagline: 基于 CloudArcade 2.1.3 源码生成的 PHP 游戏聚合站 CMS 开发文档
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/introduction
    - theme: alt
      text: 请求生命周期
      link: /architecture/request-lifecycle
    - theme: alt
      text: 术语表
      link: /glossary

features:
  - icon: 📖
    title: 指南
    details: 项目简介、目录结构、安装部署与配置说明
    link: /guide/introduction
  - icon: 🏗️
    title: 架构
    details: 请求生命周期、数据库设计（27 张表）与安全机制
    link: /architecture/request-lifecycle
  - icon: 📦
    title: 核心类
    details: Game / User / Category 等 8 个核心数据模型详解
    link: /classes/game
  - icon: 🔌
    title: 接口
    details: 前台 API（分数/排行/广告）与后台 AJAX 接口
    link: /api/public-api
  - icon: 🎛️
    title: 后台管理
    details: 游戏、内容、外观与插件管理
    link: /admin/overview
  - icon: 🎨
    title: 主题与插件
    details: 主题系统、模板函数与插件机制
    link: /theming/overview
---

## 关于本项目

**CloudArcade** 是一个基于 PHP + PDO + MySQL 的 HTML5 游戏聚合站 **CMS**，支持游戏管理、用户系统、多语言、主题与插件扩展。

本 Wiki 由源码自动整理生成，涵盖：

- **指南**：如何安装、配置与理解目录结构
- **架构**：请求处理流程、数据库设计与安全机制
- **核心类**：8 个数据模型类的完整 API 说明
- **接口**：前台与后台的接口清单与实现细节
- **后台**：后台管理各模块的操作说明
- **主题与插件**：扩展开发指南

## 阅读提示

::: tip 悬停弹词
本文档中的专业英语单词与技术名词带有下划虚线，**鼠标悬停**即可查看**音标（IPA）**与中文解析，帮助理解。
:::

示例：将鼠标悬停在 **PHP**、**PDO**、**SQL INJECTION**、**SLUG**、**API**、**MVC** 等词上体验一下。

## 快速导航

| 想了解 | 前往 |
| --- | --- |
| 这个项目是什么 | [项目简介](/guide/introduction) |
| 怎么安装部署 | [安装部署](/guide/installation) |
| 一次请求怎么处理 | [请求生命周期](/architecture/request-lifecycle) |
| 数据库有哪些表 | [数据库设计](/architecture/database) |
| Game 类怎么用 | [Game 游戏类](/classes/game) |
| 前台有哪些接口 | [前台 API](/api/public-api) |
| 怎么开发主题 | [主题系统](/theming/overview) |
| 怎么开发插件 | [插件机制](/plugins/plugin-system) |
| 英文单词/术语查询 | [术语表](/glossary) |
