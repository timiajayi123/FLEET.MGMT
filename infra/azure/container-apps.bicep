@description('Azure region for the fleet management demo.')
param location string = resourceGroup().location

@description('Container Apps managed environment name.')
param containerAppsEnvironmentName string

@description('Frontend Container App name.')
param frontendAppName string

@description('Backend Container App name.')
param backendAppName string

@description('Azure Container Registry login server, for example myregistry.azurecr.io.')
param containerRegistryServer string

@description('Frontend image name and tag.')
param frontendImage string

@description('Backend image name and tag.')
param backendImage string

@secure()
@description('Azure SQL Database connection string for Prisma SQL Server.')
param databaseUrl string

@secure()
@description('Session/JWT signing secret placeholder.')
param jwtSecret string

@description('Public frontend URL, usually the route-based HTTPS URL or custom domain.')
param frontendUrl string

@description('Optional Google Maps browser key. Keep browser restrictions in Google Cloud.')
param googleMapsApiKey string = ''

@description('Optional Google Maps map ID.')
param googleMapsMapId string = ''

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' existing = {
  name: containerAppsEnvironmentName
}

resource backend 'Microsoft.App/containerApps@2024-03-01' = {
  name: backendAppName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3001
        transport: 'auto'
        allowInsecure: false
      }
      secrets: [
        {
          name: 'database-url'
          value: databaseUrl
        }
        {
          name: 'jwt-secret'
          value: jwtSecret
        }
      ]
      registries: [
        {
          server: containerRegistryServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'backend'
          image: '${containerRegistryServer}/${backendImage}'
          env: [
            {
              name: 'DATABASE_URL'
              secretRef: 'database-url'
            }
            {
              name: 'JWT_SECRET'
              secretRef: 'jwt-secret'
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3001'
            }
            {
              name: 'FRONTEND_URL'
              value: frontendUrl
            }
            {
              name: 'GPS_SIMULATOR_ENABLED'
              value: 'false'
            }
            {
              name: 'COOKIE_SECURE'
              value: 'true'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/api/health'
                port: 3001
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/api/health'
                port: 3001
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

resource frontend 'Microsoft.App/containerApps@2024-03-01' = {
  name: frontendAppName
  location: location
  properties: {
    managedEnvironmentId: environment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [
        {
          server: containerRegistryServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'frontend'
          image: '${containerRegistryServer}/${frontendImage}'
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '3000'
            }
            {
              name: 'BACKEND_URL'
              value: 'https://${backend.properties.configuration.ingress.fqdn}'
            }
            {
              name: 'NEXT_PUBLIC_API_URL'
              value: '/api'
            }
            {
              name: 'NEXT_PUBLIC_SOCKET_URL'
              value: '/'
            }
            {
              name: 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'
              value: googleMapsApiKey
            }
            {
              name: 'NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID'
              value: googleMapsMapId
            }
            {
              name: 'NEXT_PUBLIC_ENABLE_GPS_SIMULATOR'
              value: 'false'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 3000
              }
              initialDelaySeconds: 10
              periodSeconds: 15
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
      }
    }
  }
  identity: {
    type: 'SystemAssigned'
  }
}

output backendFqdn string = backend.properties.configuration.ingress.fqdn
output frontendFqdn string = frontend.properties.configuration.ingress.fqdn
