/**
 * 简易压力测试脚本
 * 用于测试爬虫系统的性能和稳定性
 */

import axios from 'axios'
import { performance } from 'perf_hooks'

class StressTest {
  constructor() {
    this.config = {
      baseURL: 'http://localhost:3001',
      concurrentRequests: 10,
      totalRequests: 100,
      timeout: 30000,
      testEndpoints: [
        { method: 'GET', url: '/api/health' },
        { method: 'POST', url: '/api/crawl', data: { type: 'link', url: 'https://example.com', depth: 1 } },
        { method: 'GET', url: '/api/history?limit=10' }
      ]
    }
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      startTime: null,
      endTime: null,
      errors: []
    }
  }

  /**
   * 运行压力测试
   */
  async run() {
    console.log('🚀 开始压力测试...')
    console.log(`配置: ${this.config.concurrentRequests} 并发, ${this.config.totalRequests} 总请求`)

    this.results.startTime = performance.now()

    const batches = Math.ceil(this.config.totalRequests / this.config.concurrentRequests)

    for (let i = 0; i < batches; i++) {
      const batchPromises = []
      const requestsInBatch = Math.min(this.config.concurrentRequests, this.config.totalRequests - (i * this.config.concurrentRequests))

      for (let j = 0; j < requestsInBatch; j++) {
        batchPromises.push(this.makeRequest())
      }

      await Promise.allSettled(batchPromises)

      // 显示进度
      const completed = Math.min((i + 1) * this.config.concurrentRequests, this.config.totalRequests)
      const progress = ((completed / this.config.totalRequests) * 100).toFixed(1)
      console.log(`📊 进度: ${completed}/${this.config.totalRequests} (${progress}%)`)
    }

    this.results.endTime = performance.now()
    this.printResults()
  }

  /**
   * 执行单个请求
   */
  async makeRequest() {
    const endpoint = this.config.testEndpoints[Math.floor(Math.random() * this.config.testEndpoints.length)]
    const requestId = Math.random().toString(36).substr(2, 9)

    this.results.totalRequests++

    const startTime = performance.now()

    try {
      const config = {
        method: endpoint.method,
        url: `${this.config.baseURL}${endpoint.url}`,
        timeout: this.config.timeout,
        headers: {
          'X-Request-ID': requestId,
          'Content-Type': 'application/json'
        }
      }

      if (endpoint.data) {
        config.data = endpoint.data
      }

      const response = await axios(config)
      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.results.successfulRequests++
      this.results.totalResponseTime += responseTime
      this.results.minResponseTime = Math.min(this.results.minResponseTime, responseTime)
      this.results.maxResponseTime = Math.max(this.results.maxResponseTime, responseTime)

      // 每10个请求打印一次详细信息
      if (this.results.totalRequests % 10 === 0) {
        console.log(`✅ 请求 ${requestId}: ${endpoint.method} ${endpoint.url} - ${responseTime.toFixed(2)}ms - 状态: ${response.status}`)
      }

    } catch (error) {
      const endTime = performance.now()
      const responseTime = endTime - startTime

      this.results.failedRequests++
      this.results.totalResponseTime += responseTime

      const errorInfo = {
        requestId,
        endpoint: `${endpoint.method} ${endpoint.url}`,
        error: error.message,
        responseTime,
        timestamp: new Date().toISOString()
      }

      this.results.errors.push(errorInfo)

      console.log(`❌ 请求 ${requestId}: ${endpoint.method} ${endpoint.url} - ${responseTime.toFixed(2)}ms - 错误: ${error.message}`)
    }
  }

  /**
   * 打印测试结果
   */
  printResults() {
    const duration = this.results.endTime - this.results.startTime
    const avgResponseTime = this.results.totalResponseTime / this.results.totalRequests
    const successRate = (this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2)

    console.log('\n📈 压力测试结果')
    console.log('=' .repeat(50))
    console.log(`⏱️  总耗时: ${(duration / 1000).toFixed(2)} 秒`)
    console.log(`📊 总请求数: ${this.results.totalRequests}`)
    console.log(`✅ 成功请求: ${this.results.successfulRequests}`)
    console.log(`❌ 失败请求: ${this.results.failedRequests}`)
    console.log(`📈 成功率: ${successRate}%`)
    console.log(`⏱️  平均响应时间: ${avgResponseTime.toFixed(2)} 毫秒`)
    console.log(`🚀 最快响应时间: ${this.results.minResponseTime.toFixed(2)} 毫秒`)
    console.log(`🐢 最慢响应时间: ${this.results.maxResponseTime.toFixed(2)} 毫秒`)
    console.log(`🔄 每秒请求数: ${(this.results.totalRequests / (duration / 1000)).toFixed(2)}`)
    console.log(`📦 并发数: ${this.config.concurrentRequests}`)
    console.log('\n')

    if (this.results.errors.length > 0) {
      console.log('❌ 错误详情:')
      console.log('=' .repeat(50))
      this.results.errors.forEach((error, index) => {
        console.log(`${index + 1}. [${error.timestamp}] ${error.endpoint}`)
        console.log(`   错误: ${error.error}`)
        console.log(`   响应时间: ${error.responseTime.toFixed(2)}ms`)
        console.log(`   请求ID: ${error.requestId}`)
      })
    }

    // 保存结果到文件
    this.saveResults()
  }

  /**
   * 保存测试结果到文件
   */
  saveResults() {
    const fs = require('fs')
    const path = require('path')

    const results = {
      config: this.config,
      summary: {
        totalRequests: this.results.totalRequests,
        successfulRequests: this.results.successfulRequests,
        failedRequests: this.results.failedRequests,
        successRate: (this.results.successfulRequests / this.results.totalRequests * 100).toFixed(2),
        duration: this.results.endTime - this.results.startTime,
        averageResponseTime: this.results.totalResponseTime / this.results.totalRequests,
        minResponseTime: this.results.minResponseTime,
        maxResponseTime: this.results.maxResponseTime,
        requestsPerSecond: this.results.totalRequests / ((this.results.endTime - this.results.startTime) / 1000)
      },
      errors: this.results.errors,
      timestamp: new Date().toISOString()
    }

    const fileName = `stress-test-results-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    const filePath = path.join(process.cwd(), fileName)

    try {
      fs.writeFileSync(filePath, JSON.stringify(results, null, 2))
      console.log(`💾 测试结果已保存到: ${fileName}`)
    } catch (error) {
      console.error('保存测试结果失败:', error)
    }
  }

  /**
   * 运行爬虫特定的压力测试
   */
  async runCrawlerStressTest() {
    console.log('🔍 开始爬虫特定压力测试...')

    const testUrls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://httpbin.org/json'
    ]

    const results = []

    for (const url of testUrls) {
      console.log(`📋 测试URL: ${url}`)

      const startTime = performance.now()
      let success = false
      let error = null

      try {
        const response = await axios.post(`${this.config.baseURL}/api/crawl`, {
          type: 'link',
          url: url,
          depth: 1
        }, {
          timeout: 30000,
          headers: {
            'X-Request-ID': `crawler-test-${Date.now()}`
          }
        })

        success = response.status === 200
      } catch (err) {
        error = err.message
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      results.push({
        url,
        success,
        duration,
        error,
        timestamp: new Date().toISOString()
      })

      console.log(`   ${success ? '✅' : '❌'} ${duration.toFixed(2)}ms ${error ? '- ' + error : ''}`)
    }

    // 保存爬虫测试结果
    this.saveCrawlerTestResults(results)
    return results
  }

  /**
   * 保存爬虫测试结果
   */
  saveCrawlerTestResults(results) {
    const fs = require('fs')
    const path = require('path')

    const fileName = `crawler-stress-test-results-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`
    const filePath = path.join(process.cwd(), fileName)

    try {
      fs.writeFileSync(filePath, JSON.stringify(results, null, 2))
      console.log(`💾 爬虫测试结果已保存到: ${fileName}`)
    } catch (error) {
      console.error('保存爬虫测试结果失败:', error)
    }
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const stressTest = new StressTest()

  // 从命令行参数读取配置
  const args = process.argv.slice(2)
  const concurrentIndex = args.indexOf('--concurrent')
  const totalIndex = args.indexOf('--total')

  if (concurrentIndex !== -1 && args[concurrentIndex + 1]) {
    stressTest.config.concurrentRequests = parseInt(args[concurrentIndex + 1])
  }

  if (totalIndex !== -1 && args[totalIndex + 1]) {
    stressTest.config.totalRequests = parseInt(args[totalIndex + 1])
  }

  // 运行测试
  stressTest.run().catch(console.error)
}

export default StressTest