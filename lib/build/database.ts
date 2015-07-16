import * as through2 from 'through2'
import File = require('vinyl')
import {Config} from '../config'
import * as s from 'typescript-schema'
import * as m from 'ml-admin'
import * as u from 'ml-uservices'
import * as path from 'path'
import * as gutil from 'gulp-util'
import {Wirings, generateWiring, resolveWiring} from 'tschuss'

/*function tempCode(){
  return `
var twitterService = require('/ext/proxies-twitterService-TwitterServiceML')
var sem = require('/MarkLogic/semantics.xqy');
declareUpdate()
xdmp.directory('/customers/').toArray().forEach(function (node) {
    var customer = cts.doc(xdmp.nodeUri(node)).root;
    twitterService.getTweets(customer.twitterId, 'marklogic').then(function (tweets) {
      if (tweets.length > 0) {
          for (var i = 0; i < tweets.length; i++) {
              var tweet = tweets[i];
              var uri = "/tweets/" + tweet.id + ".json";
              xdmp.log(tweet.id);
              xdmp.log(uri);
              if (!cts.doc(uri)) {
                  xdmp.documentInsert(uri, tweet);
                  sem.rdfInsert(sem.triple(sem.iri("http://megastore.com/customers/" + customer.username + ".json"), sem.iri('http://megastore.com/tweeted'), sem.iri("http://megastore.com/" + uri)));
              }
          }
      }
    });
});
`
}*/

export interface DatabaseOptions {
  schema: s.RawSchema
  config: Config
  packageName: string
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

    return result
/*
    //TODO: TEMP HACK FOR DEMO

    let client = m.createAdminClient({
      host: options.config.database.host,
      port: options.config.database.httpPort,
      user: options.config.database.adminUser,
      password: options.config.database.adminPassword,
      database: options.model.contentDatabase
    })

    return m.installModule(client, '/updateTweets.sjs', tempCode()).then(function(){
      return m.createTask(configClient, {
        'task-enabled':true,
        'task-path': '/ext/updateTweets.sjs',
        'task-root': '/',
        'task-type': 'minutely',
        'task-period': 1,
        'task-database': options.model.contentDatabase,
        'task-modules': options.model.modulesDatabase,
        'task-user': options.config.database.adminUser
      }, 'Default').then(function(){
        return result
      })
    }).then(function(){
      let schemaClient = m.createAdminClient({
        host: options.config.database.host,
        port: options.config.database.httpPort,
        user: options.config.database.adminUser,
        password: options.config.database.adminPassword,
        database: options.model.schemaDatabase
      })
      return new Promise(function(resolve, reject){
        schemaClient.eval(`
  declareUpdate();
  var textNode = new NodeBuilder();
  textNode.addText('# geographic rules for inference\\n'+
    'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns>\\n' +
    'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema/>\\n' +
    'PREFIX ex: <http://example.com/>\\n' +
    'rule "isHVC" CONSTRUCT {\\n' +
    '  ?customer <http://megastore.com/is> <http://megastore.com/highValue>\\n' +
    '} {\\n' +
    '  ?customer <http://megastore.com/tweeted> ?tweet .\\n' +
    '  ?tweet <http://megastore.com/sentiment> <http://megastore.com/positiveSentiment>\\n' +
    '}');
  textNode = textNode.toNode();

  xdmp.documentInsert('/rules/twitter.rules', textNode)`).result(function(a){
        resolve(result)
        return a
      }, function(e){
        reject(e)
        return e
      })
    })
    })*/
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
      let configClient = m.createAdminClient({
        host: options.config.database.host,
        port: options.config.database.configPort,
        user: options.config.database.adminUser,
        password: options.config.database.adminPassword
      })

      let middle = options.config.middle
      let listenerPath = middle.listenerPath.charAt(0) === '/' ? middle.listenerPath.substring(1) : middle.listenerPath
      if (listenerPath.charAt(listenerPath.length - 1) !== '/') {
        listenerPath += '/'
      }
      let baseUri = `http://${middle.host}:${middle.port}/${listenerPath}`
      let moduleName = path.posix.join(options.packageName, s.fileNameToModuleName(path.relative(options.base || file.base, file.path)))
      let moduleSchema = schema[moduleName]
      moduleName = moduleName.replace(/\//g, '-')

      if (moduleSchema) {
        let wirings;
        try {
          wirings = resolveWiring(generateWiring(schema))
        } catch (e) {
          console.log(e)
          console.log(e.stack)
        }

  try {
        u.deploy({
          client: client,
          adminClient: adminClient,
          configClient: configClient,
          baseUri: baseUri,
          moduleName: moduleName,
          moduleSchema: moduleSchema,
          modulesDatabase: options.model.modulesDatabase,
          contentDatabase: options.model.contentDatabase,
          schema: s.rawSchemaToSchema(options.schema),
          code: file.contents.toString(),
          taskUser: options.config.database.adminUser,
          wirings: wirings
        }).then(function(){
          callback()
        }, function(e){
          gutil.log(e)
          console.log(e.stack)
          callback(e)
        })
  }catch (e) {
    console.log(e)
    console.log(e.stack)
  }

        /*u.deploy(client, adminClient, baseUri, moduleName, moduleSchema, file.contents.toString()).then(function(){
          callback()
        }, function(e){
          gutil.log(e)
          console.log(e.stack)
          callback(e)
        })*/
      } else {
        callback()
      }
    }
    if (deployed) {
      deployUservice()
    } else {
      deployPromise.then(deployUservice).catch(callback)
    }
  })
}
