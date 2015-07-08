import * as through2 from 'through2'
import File = require('vinyl')
import {Config} from '../config'
import * as s from 'typescript-schema'
import * as m from 'ml-admin'
import * as u from 'ml-uservices'
import * as path from 'path'
import * as gutil from 'gulp-util'

export interface DatabaseOptions {
  schema: s.RawSchema
  config: Config
  model: m.Model
  base?: string
}

export function cleanDatabase(options:DatabaseOptions): NodeJS.ReadWriteStream {
  let configClient = m.createAdminClient({
    host: options.config.database.host,
    port: options.config.database.configPort,
    user: options.config.database.adminUser,
    password: options.config.database.adminPassword
  })
  let cleaned = false
  let cleanedPromise = m.undeployModel(configClient, new m.StandardDeployer(), options.model).catch(function(e){
    gutil.log(e)
    console.log(e.stack)
    return e
  })

  return through2.obj(function(file: File, enc: string, callback: (error?, chunk?) => void) {
    if (!cleaned) {
      cleanedPromise.then(function(){
        cleaned = true
        callback()
      }, callback)
    }
  })
}

export function buildDatabase(options:DatabaseOptions): NodeJS.ReadWriteStream {
  let schema = s.rawSchemaToSchema(options.schema)

  let configClient = m.createAdminClient({
    host: options.config.database.host,
    port: options.config.database.configPort,
    user: options.config.database.adminUser,
    password: options.config.database.adminPassword
  })
  let deployed = false

  let deployPromise = m.deployModel(configClient, new m.StandardDeployer(), m.IF_EXISTS.clear, options.model).then(function(result){
    deployed = true
console.log('HHHH')
    return result
    }).catch(function(e){
    gutil.log(e)
    console.log(e.stack)
    return e
  })

  return through2.obj(function(file: File, enc: string, callback: (error?, chunk?) => void) {
    function deployUservice() {
      let adminClient = m.createAdminClient({
        host: options.config.database.host,
        port: options.config.database.adminPort,
        user: options.config.database.adminUser,
        password: options.config.database.adminPassword
      })

      let client = m.createAdminClient({
        host: options.config.database.host,
        port: options.config.database.httpPort,
        user: options.config.database.adminUser,
        password: options.config.database.adminPassword,
        database: options.model.servers[Object.keys(options.model.servers)[0]].contentDatabase
      })

      let middle = options.config.middle
      let listenerPath = middle.listenerPath.charAt(0) === '/' ? middle.listenerPath.substring(1) : middle.listenerPath
      if (listenerPath.charAt(listenerPath.length - 1) !== '/') {
        listenerPath += '/'
      }
      let baseUri = `http://${middle.host}:${middle.port}/${listenerPath}`
      let moduleName = s.fileNameToModuleName(path.relative(options.base || file.base, file.path))
      let moduleSchema = schema[moduleName]

      u.deploy(client, adminClient, baseUri, moduleName, moduleSchema, file.contents.toString()).then(function(){
        callback()
      }, function(e){
        gutil.log(e)
        console.log(e.stack)
        callback(e)
      })
    }
    if (deployed) {
      deployUservice()
    } else {
      deployPromise.then(deployUservice).catch(callback)
    }
  })
}
