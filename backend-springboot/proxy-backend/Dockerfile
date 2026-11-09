# Stage 1: Build Spring Boot JAR
FROM maven:3.9.6-eclipse-temurin-17 AS builder
WORKDIR /app

# Copy pom.xml và tải dependencies trước để tận dụng Docker layer cache
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Copy mã nguồn và đóng gói JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime image siêu nhẹ
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Tạo non-root user cho mục đích an toàn thông tin
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/target/*.jar app.jar
RUN chown appuser:appgroup app.jar

USER appuser

EXPOSE 8080

ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
