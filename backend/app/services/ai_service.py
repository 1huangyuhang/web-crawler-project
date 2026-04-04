"""
AI service: natural language to SQL via DeepSeek, with validation and chart suggestion.
"""

import re
import logging
import httpx

logger = logging.getLogger(__name__)

DANGEROUS_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE)\b",
    re.IGNORECASE,
)


def get_schema_description() -> str:
    """Build a human-readable database schema description for the LLM prompt."""
    return """
PostgreSQL 数据库包含以下表：

1. spider_tasks（爬虫任务表）
   - id: UUID 主键
   - target_url: VARCHAR 目标URL
   - crawler_type: VARCHAR 爬虫类型 ('link','content','image')
   - depth: INTEGER 爬取深度
   - status: VARCHAR 状态 ('pending','queued','running','completed','failed')
   - total_items: INTEGER 爬取数据条数
   - duration_seconds: FLOAT 耗时(秒)
   - progress: INTEGER 进度(0-100)
   - config: JSONB 配置
   - error_detail: JSONB 错误详情
   - created_at: TIMESTAMP 创建时间
   - completed_at: TIMESTAMP 完成时间

2. crawled_data（爬取数据表）
   - id: UUID 主键
   - task_id: UUID 关联 spider_tasks.id
   - source_url: VARCHAR 数据来源URL
   - raw_data: JSONB 原始爬取数据
   - cleaned_data: JSONB 清洗后数据
   - depth_level: INTEGER 爬取深度层级
   - crawled_at: TIMESTAMP 爬取时间

3. spider_templates（爬虫模板表）
   - id: UUID 主键
   - name: VARCHAR 模板名称
   - category: VARCHAR 分类
   - description: TEXT 描述
   - url_patterns: JSONB URL匹配模式
   - is_builtin: BOOLEAN 是否内置
   - version: INTEGER 版本号
   - created_at: TIMESTAMP

4. users（用户表）
   - id: UUID 主键
   - username: VARCHAR 用户名
   - email: VARCHAR 邮箱
   - created_at: TIMESTAMP

5. task_logs（任务日志表）
   - id: UUID 主键
   - task_id: UUID 关联 spider_tasks.id
   - level: VARCHAR 日志级别
   - message: TEXT 日志内容
   - metadata: JSONB 元数据
   - created_at: TIMESTAMP
""".strip()


SYSTEM_PROMPT = """你是一个专业的 PostgreSQL SQL 生成助手。用户会用自然语言描述他们想查询的数据，你需要生成对应的 SQL 查询语句。

规则：
1. 只生成 SELECT 查询语句，绝对不允许 INSERT/UPDATE/DELETE/DROP/ALTER/CREATE
2. 输出纯 SQL，不要包含 markdown 代码块标记或任何解释文字
3. 使用 PostgreSQL 语法
4. 查询结果限制最多 1000 行（自动添加 LIMIT 1000）
5. 日期时间使用 TIMESTAMP 类型比较
6. JSONB 字段使用 ->> 操作符提取文本值
7. 如果用户的问题不明确，尽量生成最合理的查询

数据库结构如下：
{schema}
"""


async def generate_sql(
    question: str,
    *,
    api_key: str,
    base_url: str,
    model: str,
) -> str:
    """Call an OpenAI-compatible chat completions API to convert natural language to SQL."""
    if not api_key or not api_key.strip():
        raise ValueError("API Key 为空，请检查模型供应商配置或环境变量 DEEPSEEK_API_KEY。")

    url = f"{base_url.rstrip('/')}/chat/completions"
    schema = get_schema_description()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT.format(schema=schema)},
        {"role": "user", "content": question},
    ]

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {api_key.strip()}",
                "Content-Type": "application/json",
            },
            json={
                "model": model.strip(),
                "messages": messages,
                "temperature": 0,
                "max_tokens": 1024,
            },
        )
        resp.raise_for_status()
        data = resp.json()

    sql = data["choices"][0]["message"]["content"].strip()

    # Strip markdown code fences if present
    if sql.startswith("```"):
        lines = sql.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        sql = "\n".join(lines).strip()

    return sql


def validate_sql(sql: str) -> str:
    """Validate that the SQL is a safe read-only SELECT statement. Returns cleaned SQL."""
    cleaned = sql.strip().rstrip(";")

    if DANGEROUS_KEYWORDS.search(cleaned):
        raise ValueError("SQL 包含不允许的操作（仅允许 SELECT 查询）")

    if not cleaned.upper().lstrip().startswith("SELECT"):
        raise ValueError("只允许 SELECT 查询语句")

    # Ensure LIMIT exists
    if "LIMIT" not in cleaned.upper():
        cleaned += " LIMIT 1000"

    return cleaned + ";"


def suggest_chart(columns: list[str], rows: list[dict]) -> dict | None:
    """Heuristic chart type suggestion based on result shape."""
    if not rows or not columns:
        return None

    num_cols = [c for c in columns if all(isinstance(r.get(c), (int, float)) for r in rows[:10] if r.get(c) is not None)]
    str_cols = [c for c in columns if c not in num_cols]

    # Single numeric column + single string column -> bar or pie chart
    if len(str_cols) == 1 and len(num_cols) == 1:
        chart_type = "pie" if len(rows) <= 8 else "bar"
        return {
            "type": chart_type,
            "labelField": str_cols[0],
            "valueField": num_cols[0],
        }

    # Date-like string column + numeric column -> line chart
    if len(str_cols) == 1 and len(num_cols) >= 1:
        label = str_cols[0]
        sample = str(rows[0].get(label, ""))
        if re.match(r"\d{4}-\d{2}", sample):
            return {
                "type": "line",
                "labelField": label,
                "valueField": num_cols[0],
            }

    # Two numeric columns -> scatter (not common, skip)
    # Multiple numeric columns -> grouped bar
    if len(str_cols) == 1 and len(num_cols) > 1:
        return {
            "type": "bar",
            "labelField": str_cols[0],
            "valueField": num_cols[0],
        }

    return None
