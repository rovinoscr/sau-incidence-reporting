@description('Base name used to derive resource names. Must be globally unique for the Web App hostname.')
param appName string

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('App Service Plan SKU. F1 is the free tier (CPU quota, no custom domain SSL, no Always On). B1 is the cheapest paid tier with no quota.')
@allowed([
  'F1'
  'B1'
])
param skuName string = 'F1'

@description('Bcrypt hash of the password required to sign in to /admin. Generate with: node -e "const b=require(\'bcryptjs\');console.log(b.hashSync(\'<password>\',12))"')
@secure()
param adminPassword string

@description('Secret used to sign the admin session cookie. Generate with: openssl rand -hex 32')
@secure()
param adminSessionSecret string

@description('Secret used to encrypt optional reporter emails at rest. Generate with: openssl rand -hex 32')
@secure()
param emailEncryptionSecret string

var isFreeTier = skuName == 'F1'

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${appName}-plan'
  location: location
  sku: {
    name: skuName
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  kind: 'app,linux'
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: !isFreeTier
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'false'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'DATABASE_PATH'
          value: '/home/data/sau-incidence-reporting.db'
        }
        {
          name: 'ADMIN_PASSWORD'
          value: adminPassword
        }
        {
          name: 'ADMIN_SESSION_SECRET'
          value: adminSessionSecret
        }
        {
          name: 'EMAIL_ENCRYPTION_SECRET'
          value: emailEncryptionSecret
        }
      ]
    }
  }
}

output webAppName string = webApp.name
output webAppUrl string = 'https://${webApp.properties.defaultHostName}'
