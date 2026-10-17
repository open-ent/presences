#!/bin/bash

MVN_OPTS="-Duser.home=/var/maven -T 4"


if [ ! -e node_modules ]; then
  mkdir node_modules
fi

case $(uname -s) in
MINGW*)
  USER_UID=1000
  GROUP_UID=1000
  ;;
*)
  if [ -z ${USER_UID:+x} ]; then
    USER_UID=$(id -u)
    GROUP_GID=$(id -g)
  fi
  ;;
esac

# Interface React (frontend/, Vite) : construite sur l'hôte puis rangée dans les ressources du module, pour que
# `./build.sh install` produise à lui seul le jar complet (AngularJS + React) — aucune copie à la main.
# Ancien bundle supprimé d'abord et échec franc : jamais un vieux bundle embarqué en silence.
# Prérequis : Node >= 18 (corepack) et NODE_AUTH_TOKEN (paquets @open-ent privés).
buildReact () {
  local fe dir
  for fe in incidents/frontend massmailing/frontend presences/frontend statistics-presences/frontend; do
    [ -f "$fe/package.json" ] || continue
    dir=$(dirname "$fe")
    echo "[buildReact] Construction de l'interface React ($fe)"
    (
      cd "$fe" || exit 1
      rm -rf dist
      corepack pnpm install --frozen-lockfile || exit 1
      corepack pnpm build || exit 1
      ls dist/public/*.js >/dev/null 2>&1 || { echo "[buildReact] aucun bundle dans dist/public : build React invalide"; exit 1; }
    ) || { echo "[buildReact] ÉCHEC ($fe)"; exit 1; }
    mkdir -p "$dir/src/main/resources/public"
    cp -r "$fe/dist/public/." "$dir/src/main/resources/public/"
  done
}

clean () {
  docker-compose run --rm maven mvn $MVN_OPT clean
}


buildNode() {
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build && yarn run build:sass"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js build && yarn run build:sass"
    ;;
  esac
}

test() {
  rm -rf coverage
  rm -rf */build
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js drop-cache &&  yarn test"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js drop-cache && yarn test"
    ;;
  esac
}

testNode () {
  rm -rf coverage
  rm -rf */build
  case `uname -s` in
    MINGW*)
      docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js drop-cache && yarn test"
      ;;
    *)
      docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js drop-cache && yarn test"
  esac
}

testNodeDev () {
  rm -rf coverage
  rm -rf */build
  case `uname -s` in
    MINGW*)
      docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js drop-cache && yarn run test:dev"
      ;;
    *)
      docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js drop-cache && yarn run test:dev"
  esac
}

test () {
  docker compose run --rm maven mvn $MVN_OPTS test
}


install () {
  buildReact
  docker compose run --rm maven mvn $MVN_OPTS clean install -U -DskipTests
}

buildGulp() {
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build"
}

buildCss() {
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn run build:sass"
}

publish() {
  version=`docker compose run --rm maven mvn $MVN_OPTS help:evaluate -Dexpression=project.version -q -DforceStdout`
  level=`echo $version | cut -d'-' -f3`
  case "$level" in
    *SNAPSHOT) export nexusRepository='snapshots' ;;
    *)         export nexusRepository='releases' ;;
  esac
  docker compose run --rm  maven mvn $MVN_OPTS -DrepositoryId=ode-$nexusRepository -DskipTests -Dmaven.test.skip=true --settings /var/maven/.m2/settings.xml deploy
}

presences() {
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build --targetModule=presences && yarn run build:sass"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js build --targetModule=presences && yarn run build:sass"
    ;;
  esac
  docker-compose run --rm maven mvn $MVN_OPTS -pl presences -am install -DskipTests

}

presences:buildMaven() {
  docker-compose run --rm maven mvn $MVN_OPTS -pl presences -am install -DskipTests
}

incidents() {
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build --targetModule=incidents && yarn run build:sass"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js build --targetModule=incidents && yarn run build:sass"
    ;;
  esac
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :incidents:shadowJar :incidents:install :incidents:publishToMavenLocal
}

incidents:buildGradle() {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :incidents:shadowJar :incidents:install :incidents:publishToMavenLocal
}

massmailing() {
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build --targetModule=massmailing && yarn run build:sass"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js build --targetModule=massmailing && yarn run build:sass"
    ;;
  esac
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :massmailing:shadowJar :massmailing:install :massmailing:publishToMavenLocal
}

massmailing:buildGradle() {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :massmailing:shadowJar :massmailing:install :massmailing:publishToMavenLocal
}

statistics() {
  case $(uname -s) in
  MINGW*)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install --no-bin-links && node_modules/gulp/bin/gulp.js build --targetModule=statistics-presences && yarn run build:sass"
    ;;
  *)
    docker-compose run --rm -u "$USER_UID:$GROUP_GID" node sh -c "yarn install && node_modules/gulp/bin/gulp.js build --targetModule=statistics-presences && yarn run build:sass"
    ;;
  esac
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :statistics:shadowJar :statistics:install :statistics:publishToMavenLocal
}

statistics:buildGradle() {
  docker-compose run --rm -u "$USER_UID:$GROUP_GID" gradle gradle :statistics:shadowJar :statistics:install :statistics:publishToMavenLocal
}

publishNexus() {
  version=`docker compose run --rm maven mvn $MVN_OPTS help:evaluate -Dexpression=project.version -q -DforceStdout`
  level=`echo $version | cut -d'-' -f3`
  case "$level" in
    *SNAPSHOT) export nexusRepository='snapshots' ;;
    *)         export nexusRepository='releases' ;;
  esac
  docker compose run --rm  maven mvn $MVN_OPTS -DrepositoryId=ode-$nexusRepository -Durl=$repo -DskipTests -Dmaven.test.skip=true --settings /var/maven/.m2/settings.xml deploy
}

# If DEBUG env var is set to "true" then set -x to enable debug mode
if [ "$DEBUG" == "true" ]; then
	set -x
	EDIFICE_CLI_DEBUG_OPTION="--debug"
else
	EDIFICE_CLI_DEBUG_OPTION=""
fi

init() {
  me=`id -u`:`id -g`
  echo "DEFAULT_DOCKER_USER=$me" > .env

  # If CLI_VERSION is empty set to latest
  if [ -z "$CLI_VERSION" ]; then
    CLI_VERSION="latest"
  fi
  curl -sfL https://maven.opendigitaleducation.com/repository/releases/io/edifice/edifice-cli/install.sh | TARGET_DIR=. EDIFICE_CLI_VERSION=$CLI_VERSION bash
  ./edifice version $EDIFICE_CLI_DEBUG_OPTION
}

if [ ! -e .env ]; then
  init
fi

for param in "$@"; do
  case $param in
  init)
    init
    ;;
  clean)
    clean
    ;;
  buildNode)
    buildNode
    ;;
  buildMaven)
    install
    ;;
  buildGulp)
    buildGulp
    ;;
  buildCss)
    buildCss
    ;;
  install)
    buildNode && install
    ;;
  publish)
    publish
    ;;
  publishNexus)
    publishNexus
    ;;
  test)
    testNode ; test
    ;;
  testNode)
    testNode
  ;;
  testNodeDev)
    testNodeDev
  ;;
  testMaven)
    test
    ;;
  presences)
    presences
    ;;
  incidents)
    incidents
    ;;
  massmailing)
    massmailing
    ;;
  statistics)
    statistics
    ;;
  presences:buildMaven)
    presences:buildMaven
    ;;
  incidents:buildGradle)
    incidents:buildGradle
    ;;
  massmailing:buildGradle)
    massmailing:buildGradle
    ;;
  statistics:buildGradle)
    statistics:buildGradle
    ;;
  *)
    echo "Invalid argument : $param"
    ;;
  esac
  if [ ! $? -eq 0 ]; then
    exit 1
  fi
done
