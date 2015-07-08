// Type definitions for Browserify
// Project: http://browserify.org/
// Definitions by: Andrew Gaspar <https://github.com/AndrewGaspar/>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

interface BrowserifyObject extends NodeJS.EventEmitter {
  add(file:string): BrowserifyObject;
  require(file:string, opts?:{
    expose: string;
  }): BrowserifyObject;
  bundle(cb?:(err:any, src:any) => void): NodeJS.ReadableStream;

  external(file:string): BrowserifyObject;
  ignore(file:string): BrowserifyObject;
  transform(tr:string): BrowserifyObject;
  transform(tr:Function): BrowserifyObject;
  plugin(plugin:string, opts?:any): BrowserifyObject;
  plugin(plugin:Function, opts?:any): BrowserifyObject;
}

interface Stream {
  pipe<T extends NodeJS.ReadWriteStream>(
    stream: T,
    opts?: {
      end?: boolean;
    }
  ): T
}

interface Browserify {
  (): BrowserifyObject;
  (files:string[]|string|Stream, opts?:{
    insertGlobals?: boolean;
    detectGlobals?: boolean;
    debug?: boolean;
    standalone?: string;
    insertGlobalVars?: any;
  }): BrowserifyObject;
  (opts:{
    entries?: string[];
    noParse?: string[];
  }): BrowserifyObject;
}

declare module "browserify" {
  var browserify: Browserify;
  export = browserify;
}
