# ── Build stage ────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /workspace

COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
RUN ./mvnw dependency:go-offline -q

COPY src src
RUN ./mvnw package -DskipTests -q

# ── Runtime stage ──────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN addgroup -S shcp && adduser -S shcp -G shcp && \
    mkdir -p /app/uploads && \
    chown -R shcp:shcp /app

COPY --from=build /workspace/target/*.jar app.jar

RUN chown shcp:shcp /app/app.jar

USER shcp

EXPOSE 8080

ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75"

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
    CMD wget -qO- http://127.0.0.1:8080/actuator/health || exit 1

ENTRYPOINT ["sh", "-c", "if [ -n \"$FIREBASE_CREDENTIALS_JSON\" ]; then printf '%s' \"$FIREBASE_CREDENTIALS_JSON\" | base64 -d > /tmp/fcm-credentials.json; fi && java $JAVA_OPTS -jar app.jar"]
