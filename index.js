var fs = require("fs")
  , mkdir = require("mkdirp")
  , chownr = require("chownr")

// to maintain the cache dir's permissions consistently.
var cacheStat = null

exports.getCacheStat = getCacheStat
function getCacheStat (npm, log, cb) {
  if (cacheStat) return cb(null, cacheStat)
  fs.stat(npm.cache, function (er, st) {
    if (er) return makeCacheDir(npm, log, cb)
    if (!st.isDirectory()) {
      log.error("getCacheStat", "invalid cache dir %j", npm.cache)
      return cb(er)
    }
    return cb(null, cacheStat = st)
  })
}

exports.makeCacheDir = makeCacheDir
function makeCacheDir (npm, log, cb) {
  if (!process.getuid) return mkdir(npm.cache, cb)

  var uid = +process.getuid()
    , gid = +process.getgid()

  if (uid === 0) {
    if (process.env.SUDO_UID) uid = +process.env.SUDO_UID
    if (process.env.SUDO_GID) gid = +process.env.SUDO_GID
  }

  if (uid !== 0 || !process.env.HOME) {
    cacheStat = {uid: uid, gid: gid}
    return mkdir(npm.cache, afterMkdir)
  }

  fs.stat(process.env.HOME, function (er, st) {
    if (er) {
      log.error("makeCacheDir", "homeless?")
      return cb(er)
    }
    cacheStat = st
    log.silly("makeCacheDir", "cache dir uid, gid", [st.uid, st.gid])
    return mkdir(npm.cache, afterMkdir)
  })

  function afterMkdir (er, made) {
    if (er || !cacheStat || isNaN(cacheStat.uid) || isNaN(cacheStat.gid)) {
      return cb(er, cacheStat)
    }

    if (!made) return cb(er, cacheStat)

    // ensure that the ownership is correct.
    chownr(made, cacheStat.uid, cacheStat.gid, function (er) {
      return cb(er, cacheStat)
    })
  }
}
