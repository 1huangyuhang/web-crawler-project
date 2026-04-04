-- =========================================
-- 爬虫系统数据库初始化脚本
-- =========================================

-- 创建数据库
CREATE DATABASE IF NOT EXISTS crawler_db;

-- 切换到爬虫数据库
\c crawler_db;

-- 创建数据库用户（如果不存在）
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'crawler_user') THEN
        CREATE USER crawler_user WITH PASSWORD 'crawler_password';
    END IF;
END $$;

-- 授权给用户
GRANT ALL PRIVILEGES ON DATABASE crawler_db TO crawler_user;

-- 创建必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- 创建schema（如果Prisma需要特定的schema）
CREATE SCHEMA IF NOT EXISTS crawler;
GRANT ALL PRIVILEGES ON SCHEMA crawler TO crawler_user;

-- =========================================
-- 表结构创建（Prisma将自动管理，以下为手动创建版本）
-- =========================================

-- 1. 爬取任务记录表
CREATE TABLE IF NOT EXISTS crawl_record (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    target_url TEXT NOT NULL,
    depth INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    items INTEGER DEFAULT 0,
    time FLOAT DEFAULT 0,
    data JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 爬虫任务队列表
CREATE TABLE IF NOT EXISTS crawl_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL,
    target_url TEXT NOT NULL,
    depth INTEGER NOT NULL,
    priority INTEGER DEFAULT 5,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. 爬取统计数据表
CREATE TABLE IF NOT EXISTS crawl_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawl_id UUID UNIQUE NOT NULL,
    total_urls INTEGER DEFAULT 0,
    success_urls INTEGER DEFAULT 0,
    failed_urls INTEGER DEFAULT 0,
    total_links INTEGER DEFAULT 0,
    total_images INTEGER DEFAULT 0,
    total_content INTEGER DEFAULT 0,
    avg_response_time FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 访问日志表
CREATE TABLE IF NOT EXISTS access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time FLOAT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 爬虫配置表
CREATE TABLE IF NOT EXISTS crawler_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    max_depth INTEGER DEFAULT 3,
    max_pages INTEGER DEFAULT 100,
    timeout INTEGER DEFAULT 30,
    user_agent TEXT,
    headers JSONB,
    rules JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- 索引创建
-- =========================================

-- 爬取记录表索引
CREATE INDEX IF NOT EXISTS idx_crawl_record_type_status ON crawl_record(type, status);
CREATE INDEX IF NOT EXISTS idx_crawl_record_created_at ON crawl_record(created_at);
CREATE INDEX IF NOT EXISTS idx_crawl_record_target_url ON crawl_record(target_url);
CREATE INDEX IF NOT EXISTS idx_crawl_record_data_gin ON crawl_record USING GIN (data);

-- 系统配置表索引
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- 任务队列表索引
CREATE INDEX IF NOT EXISTS idx_crawl_queue_status_priority ON crawl_queue(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_type ON crawl_queue(type);
CREATE INDEX IF NOT EXISTS idx_crawl_queue_created_at ON crawl_queue(created_at);

-- 统计信息表索引
CREATE INDEX IF NOT EXISTS idx_crawl_stats_crawl_id ON crawl_stats(crawl_id);
CREATE INDEX IF NOT EXISTS idx_crawl_stats_created_at ON crawl_stats(created_at);

-- 访问日志表索引
CREATE INDEX IF NOT EXISTS idx_access_log_created_at ON access_log(created_at);
CREATE INDEX IF NOT EXISTS idx_access_log_ip_address ON access_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_access_log_endpoint ON access_log(endpoint);
CREATE INDEX IF NOT EXISTS idx_access_log_status_code ON access_log(status_code);

-- 爬虫配置表索引
CREATE INDEX IF NOT EXISTS idx_crawler_config_type_active ON crawler_config(type, is_active);
CREATE INDEX IF NOT EXISTS idx_crawler_config_name ON crawler_config(name);

-- =========================================
-- 触发器函数（用于自动更新updated_at）
-- =========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为需要自动更新的表创建触发器
CREATE TRIGGER trigger_crawl_record_updated_at
    BEFORE UPDATE ON crawl_record
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_system_config_updated_at
    BEFORE UPDATE ON system_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_crawl_queue_updated_at
    BEFORE UPDATE ON crawl_queue
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_crawl_stats_updated_at
    BEFORE UPDATE ON crawl_stats
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_crawler_config_updated_at
    BEFORE UPDATE ON crawler_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 视图创建（用于数据分析）
-- =========================================

-- 爬取任务概览视图
CREATE OR REPLACE VIEW v_crawl_overview AS
SELECT
    type,
    status,
    COUNT(*) as total_count,
    AVG(time) as avg_time,
    SUM(items) as total_items,
    MIN(created_at) as earliest_date,
    MAX(created_at) as latest_date
FROM crawl_record
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY type, status
ORDER BY type, status;

-- 系统性能监控视图
CREATE OR REPLACE VIEW v_system_performance AS
SELECT
    DATE(created_at) as date,
    COUNT(*) as total_requests,
    AVG(response_time) as avg_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count
FROM access_log
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- 爬虫效率统计视图
CREATE OR REPLACE VIEW v_crawler_efficiency AS
SELECT
    cr.type,
    COUNT(*) as total_tasks,
    AVG(cs.total_urls) as avg_total_urls,
    AVG(cs.success_urls) as avg_success_urls,
    AVG(cs.failed_urls) as avg_failed_urls,
    AVG(cs.avg_response_time) as avg_response_time
FROM crawl_record cr
LEFT JOIN crawl_stats cs ON cr.id = cs.crawl_id
WHERE cr.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY cr.type;

-- =========================================
-- 存储过程
-- =========================================

-- 清理过期数据的存储过程
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- 清理访问日志（保留指定天数）
    DELETE FROM access_log
    WHERE created_at < CURRENT_DATE - days_to_keep;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    -- 清理完成的爬取任务（保留指定天数）
    DELETE FROM crawl_record
    WHERE status = 'completed' AND created_at < CURRENT_DATE - days_to_keep;
    GET DIAGNOSTICS deleted_count = ROW_COUNT + deleted_count;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 获取队列统计信息的存储过程
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE (
    status VARCHAR(50),
    count BIGINT,
    avg_priority FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        cq.status::VARCHAR(50),
        COUNT(*)::BIGINT,
        AVG(cq.priority)::FLOAT
    FROM crawl_queue cq
    GROUP BY cq.status;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 默认数据插入
-- =========================================

-- 插入默认的系统配置
INSERT INTO system_config (key, value) VALUES
    ('max_concurrent_crawls', '5'),
    ('default_crawl_timeout', '30'),
    ('rate_limit_per_minute', '60'),
    ('user_agent', 'Mozilla/5.0 (compatible; CrawlerBot/1.0)')
ON CONFLICT (key) DO NOTHING;

-- 插入默认的爬虫配置
INSERT INTO crawler_config (name, description, type, max_depth, max_pages, timeout, user_agent) VALUES
    ('默认链接爬虫', '默认的链接爬取配置', 'link', 3, 100, 30, 'Mozilla/5.0 (compatible; CrawlerBot/1.0)'),
    ('默认内容爬虫', '默认的内容爬取配置', 'content', 2, 50, 30, 'Mozilla/5.0 (compatible; CrawlerBot/1.0)'),
    ('默认图片爬虫', '默认的图片爬取配置', 'image', 2, 30, 30, 'Mozilla/5.0 (compatible; CrawlerBot/1.0)')
ON CONFLICT (name) DO NOTHING;

-- =========================================
-- 权限设置
-- =========================================

-- 授予表权限
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crawler_user;

-- 授予序列权限（如果使用序列）
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO crawler_user;

-- 授予函数权限
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO crawler_user;

-- 授予视图权限
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crawler_user;

-- =========================================
-- 数据库优化设置
-- =========================================

-- 设置连接数限制（可选）
ALTER ROLE crawler_user CONNECTION LIMIT 100;

-- 设置语句超时（可选）
ALTER ROLE crawler_user SET statement_timeout = '300s';

-- 设置空闲事务超时（可选）
ALTER ROLE crawler_user SET idle_in_transaction_session_timeout = '60s';

-- =========================================
-- 完成信息
-- =========================================

SELECT '数据库初始化完成！' as status;
SELECT '已创建的表:' as info;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;