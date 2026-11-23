# Apache Jena Fuseki (query-only) with a persistent TDB2 database.
# The same image is used by the one-shot `kg-loader` service (load / backup / restore).

FROM eclipse-temurin:21.0.13_9-jre-alpine

ARG JENA_VERSION=6.2.0
ARG JENA_JAR_SHA1=d3490295a2b95677c1227d25bca8564d40f993a7
ARG MAVEN_REPO=https://repo1.maven.org/maven2

ENV FUSEKI_HOME=/fuseki \
    FUSEKI_JAR=/fuseki/fuseki-server.jar \
    TDB2_DATA_DIR=/fuseki/databases/movielens \
    JAVA_OPTIONS="-Xms256m -Xmx1024m" \
    SPARQL_QUERY_TIMEOUT_SECONDS=15

RUN apk add --no-cache curl \
 && addgroup -g 1000 fuseki \
 && adduser -D -H -u 1000 -G fuseki -s /sbin/nologin fuseki \
 && mkdir -p /fuseki/databases /fuseki/backups /fuseki/staging /fuseki/run \
 && curl -fsSL -o "${FUSEKI_JAR}" \
      "${MAVEN_REPO}/org/apache/jena/jena-fuseki-server/${JENA_VERSION}/jena-fuseki-server-${JENA_VERSION}.jar" \
 && echo "${JENA_JAR_SHA1}  ${FUSEKI_JAR}" | sha1sum -c - \
 && chown -R fuseki:fuseki /fuseki

COPY --chown=fuseki:fuseki config.ttl.template /fuseki/config.ttl.template
COPY --chown=fuseki:fuseki --chmod=0755 entrypoint.sh kg-admin.sh /fuseki/

USER fuseki
WORKDIR /fuseki
EXPOSE 3030

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -fsS http://localhost:3030/\$/ping > /dev/null || exit 1

ENTRYPOINT ["/fuseki/entrypoint.sh"]
