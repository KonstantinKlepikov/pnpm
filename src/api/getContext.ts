import path = require('path')
import safeReadPkg from '../fs/safeReadPkg'
import writePkg = require('write-pkg')
import expandTilde, {isHomepath} from '../fs/expandTilde'
import {StrictPnpmOptions} from '../types'
import {
  read as readShrinkwrap,
  readPrivate as readPrivateShrinkwrap,
  Shrinkwrap,
} from '../fs/shrinkwrap'
import {
  read as readModules,
} from '../fs/modulesController'
import mkdirp = require('mkdirp-promise')
import {PackagePlaceholder} from '../types'
import normalizePath = require('normalize-path')
import removeAllExceptOuterLinks = require('remove-all-except-outer-links')
import logger from 'pnpm-logger'
import checkCompatibility from './checkCompatibility'

export type PnpmContext = {
  pkg: PackagePlaceholder,
  storePath: string,
  root: string,
  privateShrinkwrap: Shrinkwrap,
  shrinkwrap: Shrinkwrap,
  skipped: string[],
}

export default async function getContext (opts: StrictPnpmOptions, installType?: 'named' | 'general'): Promise<PnpmContext> {
  const pkg: PackagePlaceholder = await safeReadPkg(opts.prefix) || {}
  const root = normalizePath(opts.prefix)
  const storeBasePath = resolveStoreBasePath(opts.storePath, root)

  const storePath = getStorePath(storeBasePath)

  const modulesPath = path.join(root, 'node_modules')
  let modules = await readModules(modulesPath)

  if (modules) {
    try {
      checkCompatibility(modules, {storePath, modulesPath})
    } catch (err) {
      if (!opts.force) throw err
      if (installType !== 'general') {
        throw new Error('Named installation cannot be used to regenerate the node_modules structure. Run pnpm install --force')
      }
      logger.info(`Recreating ${modulesPath}`)
      await removeAllExceptOuterLinks(modulesPath)
      return getContext(opts)
    }
  }

  const shrinkwrap = await readShrinkwrap(root, {force: opts.force, registry: opts.registry})
  const ctx: PnpmContext = {
    pkg,
    root,
    storePath,
    shrinkwrap,
    privateShrinkwrap: await readPrivateShrinkwrap(root, {force: opts.force, registry: opts.registry}),
    skipped: modules && modules.skipped || [],
  }

  await mkdirp(ctx.storePath)
  return ctx
}

function resolveStoreBasePath (storePath: string, pkgRoot: string) {
  if (isHomepath(storePath)) {
    return expandTilde(storePath)
  }
  return path.resolve(pkgRoot, storePath)
}

function getStorePath (storeBasePath: string): string {
  if (underNodeModules(storeBasePath)) {
    return storeBasePath
  }
  return path.join(storeBasePath, '1')
}

function underNodeModules (dirpath: string): boolean {
  return dirpath.split(path.sep).indexOf('node_modules') !== -1
}
