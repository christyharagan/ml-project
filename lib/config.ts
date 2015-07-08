export interface DatabaseConfig {
  adminUser: string
  adminPassword: string
  database: string
  triggersDatabase?: string
  securityDatabase?: string
  schemaDatabase?: string
  host?: string
  httpPort?: number
  adminPort?: number
  configPort?: number
}

export interface MiddleConfig {
  host?: string
  port: number
  listenerPath: string
}

export interface Config {
  database: DatabaseConfig
  middle: MiddleConfig
}
