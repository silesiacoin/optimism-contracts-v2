/* External Imports */
import { Signer, Contract, ContractFactory } from 'ethers'

/* Internal Imports */
import { RollupDeployConfig, makeContractDeployConfig } from './config'
import { BIG_GAS_LIMIT, SMALL_GAS_LIMIT, GAS_PRICE } from '.'
import { getContractFactory } from '../contract-defs'
import { NonceManager } from '@ethersproject/experimental'

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
  if (!(config.deploymentSigner instanceof NonceManager)) {
    config.deploymentSigner = new NonceManager(config.deploymentSigner)
  }

  const Factory__SimpleProxy: ContractFactory = getContractFactory(
    'Helper_SimpleProxy',
    config.deploymentSigner
  )

  const ongoingAddressManager: Contract = await getContractFactory(
    'Lib_AddressManager',
    config.deploymentSigner
  ).deploy()
  console.log('Awaiting for address manager to be deployed')
  const AddressManager: Contract = await ongoingAddressManager.deployed()
  console.log('address manager was deployed', AddressManager.address)

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
      config.deploymentSigner.incrementTransactionCount()
      console.log('Starting contract deploy: ', name)
      contracts[name] = await contractDeployParameters.factory
        .connect(config.deploymentSigner)
        .deploy(...(contractDeployParameters.params || []), config.deployOverrides || {})
      console.log('this is a tx pending', contracts[name].address)
      const deployedContract: Contract = await contracts[name].deployed()
      console.log('Finished contract deploy: ', name, deployedContract.address)
      config.deploymentSigner.incrementTransactionCount()
      const resolvedAddress = await deployedContract.resolvedAddress
      const transactionsCount = await AddressManager.signer.getTransactionCount()
      console.log('Tx count for address manager', transactionsCount)
      const res = await SimpleProxy.setTarget(resolvedAddress, {
        gasLimit: SMALL_GAS_LIMIT,
      })
      console.log('Waiting!')
      await res.wait()
      console.log('After set address')
    } catch (err) {
      console.log('ERR: ', err)
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
