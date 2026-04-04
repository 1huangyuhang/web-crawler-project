-- 数据库验证SQL脚本
-- 用于验证数据库连接和基本功能

-- 测试数据库连接
SELECT 1 as test_connection;

-- 检查CrawlRecord表是否存在
SELECT
    COUNT(*) as table_exists
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name = 'crawl_record';

-- 检查User表是否存在
SELECT
    COUNT(*) as table_exists
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name = 'user';

-- 检查ApiKey表是否存在
SELECT
    COUNT(*) as table_exists
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name = 'api_key';

-- 检查CrawlerConfig表是否存在
SELECT
    COUNT(*) as table_exists
FROM
    information_schema.tables
WHERE
    table_schema = 'public'
    AND table_name = 'crawler_config';

-- 检查索引状态
SELECT
    indexname,
    tablename,
    indexdef
FROM
    pg_indexes
WHERE
    schemaname = 'public'
ORDER BY
    tablename, indexname;

-- 检查枚举类型
SELECT
    t.typname as enum_name,
    e.enumlabel as enum_value
FROM
    pg_type t
JOIN
    pg_enum e ON t.oid = e.enumtypid
WHERE
    t.typname IN ('crawlstatus', 'crawlertype')
ORDER BY
    t.typname, e.enumsortorder;