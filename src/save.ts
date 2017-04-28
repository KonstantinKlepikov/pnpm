import safeReadPkg from './fs/safeReadPkg'
import writePkg = require('write-pkg')
import {DependenciesType} from './getSaveType'
import {PackagePlaceholder} from './types'
import {PackageSpec} from './resolve'

export default async function save (
  pkgJsonPath: string,
  packageSpecs: ({
    name: string,
    saveSpec: string,
  })[],
  saveType: DependenciesType
): Promise<PackagePlaceholder> {
  // Read the latest version of package.json to avoid accidental overwriting
  const packageJson = await safeReadPkg(pkgJsonPath) || {}
  packageJson[saveType] = packageJson[saveType] || {}
  packageSpecs.forEach(dependency => {
    packageJson[saveType][dependency.name] = dependency.saveSpec
  })

  await writePkg(pkgJsonPath, packageJson)
  return packageJson
}
