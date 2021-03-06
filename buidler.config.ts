import { usePlugin, BuidlerConfig } from '@nomiclabs/buidler/config'

import {
  DEFAULT_ACCOUNTS_BUIDLER,
  RUN_OVM_TEST_GAS,
} from './test/helpers/constants'

usePlugin('@nomiclabs/buidler-ethers')
usePlugin('@nomiclabs/buidler-waffle')
usePlugin('buidler-typechain')

import '@eth-optimism/smock/build/src/buidler-plugins/compiler-storage-layout'

const config: BuidlerConfig = {
  networks: {
    buidlerevm: {
      accounts: DEFAULT_ACCOUNTS_BUIDLER,
      blockGasLimit: RUN_OVM_TEST_GAS * 2,
    },
  },
  mocha: {
    timeout: 50000,
  },
  solc: {
    version: '0.7.4',
    optimizer: { enabled: true, runs: 200 },
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
  },
}

export default config
