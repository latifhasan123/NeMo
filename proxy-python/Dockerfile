FROM python:3.10-slim

# Ngăn Python tạo file .pyc, tối ưu log và tăng timeout pip cho các gói AI kích thước lớn
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=300 \
    PIP_RETRIES=15

WORKDIR /app

# Copy và cài đặt thư viện Python trước để cache layer (dùng gói binary .whl sẵn, không cần tải trình biên dịch apt)
COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=300 --retries=15 --prefer-binary -r requirements.txt

# Copy toàn bộ mã nguồn và cấu hình Guardrails (.co, config.yml)
COPY . .

EXPOSE 8000

# Khởi chạy FastAPI bằng Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
