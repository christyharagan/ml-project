import * as through2 from 'through2'
import File = require('vinyl')
import * as path from 'path'
import {generateRawSchema, rawSchemaToSchema, Files} from 'typescript-schema'
import {generateModel} from 'ml-admin'
import {Config} from '../config'

export interface JsonOptions {
  definition?: Object
  config: Config
}

export function buildJson(options:JsonOptions) : NodeJS.ReadWriteStream {
  let files: Files = {}
  let base:string

  return through2.obj(function(file:File, enc: string, callback: () => void) {
    base = base || file.base

    files[path.relative(base, file.path)] = file.contents.toString()

    callback()
  }, function() {
    let rawSchema = generateRawSchema(files)
    let schema = rawSchemaToSchema(rawSchema)

    this.push(new File({
      base: base,
      path: path.join(base, 'schema.json'),
      contents: new Buffer(JSON.stringify(rawSchema, null, '  '))
    }))

    let modules = Object.keys(schema)

    if (options.definition) {
      let model = generateModel(schema, options.definition, options.config.database.host)

      this.push(new File({
        base: base,
        path: path.join(base, 'database-model.json'),
        contents: new Buffer(JSON.stringify(model, null, '  '))
      }))
    }
  })
}
