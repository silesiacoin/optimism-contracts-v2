/* External Imports */
import { Signer, Contract, ContractFactory } from 'ethers'

/* Internal Imports */
import { RollupDeployConfig, makeContractDeployConfig } from './config'
import { BIG_GAS_LIMIT, SMALL_GAS_LIMIT, GAS_PRICE } from '.'
import { getContractFactory } from '../contract-defs'

export interface DeployResult {
  AddressManager: Contract
  failedDeployments: string[]
  contracts: {
    [name: string]: Contract
  }
}

export const deploy = async (
  config: RollupDeployConfig
): Promise<DeployResult> => {
  const Factory__SimpleProxy: ContractFactory = getContractFactory(
    'Helper_SimpleProxy',
    config.deploymentSigner
  )
  const AddressManager: Contract = await getContractFactory(
    'Lib_AddressManager',
    config.deploymentSigner
  ).deploy()

  const contractDeployConfig = await makeContractDeployConfig(
    config,
    AddressManager
  )

  if (!config.deployOverrides) {
    config.deployOverrides = {
      gasLimit: BIG_GAS_LIMIT,
      gasPrice: GAS_PRICE
    }
  } else {
    config.deployOverrides.gasLimit = BIG_GAS_LIMIT
    config.deployOverrides.gasPrice = GAS_PRICE
  }

  const failedDeployments: string[] = []
  const contracts: {
    [name: string]: Contract
  } = {}

  for (const [name, contractDeployParameters] of Object.entries(
    contractDeployConfig
  )) {
    if (config.dependencies && !config.dependencies.includes(name)) {
      continue
    }

    const SimpleProxy = await Factory__SimpleProxy.deploy()
    await AddressManager.setAddress(name, SimpleProxy.address)

    contracts[`Proxy__${name}`] = SimpleProxy

    try {
      contracts[name] = await contractDeployParameters.factory
        .connect(config.deploymentSigner)
        .deploy(
          ...(contractDeployParameters.params || []),
          config.deployOverrides || {}
        )
      const res = await SimpleProxy.setTarget(contracts[name].address, {
        gasLimit: SMALL_GAS_LIMIT,
      })
      console.log('Waiting!')
      await res.wait()
    } catch (err) {
      failedDeployments.push(name)
    }
  }

  for (const [name, contractDeployParameters] of Object.entries(
    contractDeployConfig
  )) {
    if (config.dependencies && !config.dependencies.includes(name)) {
      continue
    }

    if (contractDeployParameters.afterDeploy) {
      await contractDeployParameters.afterDeploy(contracts)
    }
  }

  return {
    AddressManager,
    failedDeployments,
    contracts,
  }
}
