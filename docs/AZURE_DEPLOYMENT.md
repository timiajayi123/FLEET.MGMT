# Azure Deployment

This guide prepares the fleet-management monorepo for Microsoft Azure without touching the local SQL Server database.

## Prerequisites

- Azure subscription with permission to create Resource Groups, Azure SQL, Azure Container Registry, Container Apps, and managed identities.
- Azure CLI installed and signed in.
- GitHub repository connected to this codebase.
- Google Maps browser key restricted to the production HTTPS domain.
- No local database records are copied by this process.

## Resource Names

Use these names consistently, or replace them everywhere before running commands.

```powershell
$LOCATION="uksouth"
$RESOURCE_GROUP="rg-fleet-demo"
$ACA_ENV="cae-fleet-demo"
$ACR_NAME="acrfleetdemo"
$ACR_LOGIN_SERVER="$ACR_NAME.azurecr.io"
$FRONTEND_APP="fleet-frontend"
$BACKEND_APP="fleet-backend"
$SQL_SERVER="sql-fleet-demo"
$SQL_DATABASE="fleet_management"
$ROUTE_NAME="fleet-route"
```

## Azure CLI Setup

```powershell
az login
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.Sql
```

## Create Azure Resources

Run these only when you are ready to create billable Azure resources.

```powershell
az group create --name $RESOURCE_GROUP --location $LOCATION

az acr create `
  --resource-group $RESOURCE_GROUP `
  --name $ACR_NAME `
  --sku Basic `
  --admin-enabled false

az containerapp env create `
  --resource-group $RESOURCE_GROUP `
  --name $ACA_ENV `
  --location $LOCATION

az sql server create `
  --resource-group $RESOURCE_GROUP `
  --name $SQL_SERVER `
  --location $LOCATION `
  --admin-user fleet_admin `
  --admin-password "<strong-production-password>"

az sql db create `
  --resource-group $RESOURCE_GROUP `
  --server $SQL_SERVER `
  --name $SQL_DATABASE `
  --service-objective Basic
```

Allow GitHub-hosted runners or your current IP to reach Azure SQL only when needed.

```powershell
az sql server firewall-rule create `
  --resource-group $RESOURCE_GROUP `
  --server $SQL_SERVER `
  --name AllowAzureServices `
  --start-ip-address 0.0.0.0 `
  --end-ip-address 0.0.0.0
```

## Azure SQL Connection String

Use this format for Prisma SQL Server:

```text
sqlserver://<server>.database.windows.net:1433;database=fleet_management;user=<user>;password=<password>;encrypt=true;trustServerCertificate=false;schema=dbo
```

Store it only as `AZURE_SQL_DATABASE_URL` in GitHub Secrets and as the `database-url` secret in Azure Container Apps.

## Initial Container Apps Deployment

After images exist in Azure Container Registry, deploy the Bicep file:

```powershell
az deployment group create `
  --resource-group $RESOURCE_GROUP `
  --template-file infra/azure/container-apps.bicep `
  --parameters `
    containerAppsEnvironmentName=$ACA_ENV `
    frontendAppName=$FRONTEND_APP `
    backendAppName=$BACKEND_APP `
    containerRegistryServer=$ACR_LOGIN_SERVER `
    frontendImage="fleet-frontend:<tag>" `
    backendImage="fleet-backend:<tag>" `
    databaseUrl="<azure-sql-prisma-connection-string>" `
    jwtSecret="<strong-random-secret>" `
    frontendUrl="https://<route-or-frontend-domain>" `
    googleMapsApiKey="<browser-restricted-key>" `
    googleMapsMapId="<optional-map-id>"
```

Grant each Container App identity permission to pull images from ACR:

```powershell
$ACR_ID = az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query id -o tsv
$BACKEND_IDENTITY = az containerapp show --name $BACKEND_APP --resource-group $RESOURCE_GROUP --query identity.principalId -o tsv
$FRONTEND_IDENTITY = az containerapp show --name $FRONTEND_APP --resource-group $RESOURCE_GROUP --query identity.principalId -o tsv

az role assignment create --assignee $BACKEND_IDENTITY --role AcrPull --scope $ACR_ID
az role assignment create --assignee $FRONTEND_IDENTITY --role AcrPull --scope $ACR_ID
```

## Route-Based HTTPS Front Door

The repo includes `infra/azure/routing.yml` for path routing:

- `/api` goes to the backend.
- `/socket.io` goes to the backend.
- `/` goes to the frontend.

Create the HTTP route configuration with the current Azure Container Apps route-based routing commands for your subscription. Keep the backend and frontend apps in the same Container Apps environment. Put the `/api` and `/socket.io` rules before `/`.

```powershell
az containerapp env http-route-config create `
  --http-route-config-name $ROUTE_NAME `
  --resource-group $RESOURCE_GROUP `
  --name $ACA_ENV `
  --yaml infra/azure/routing.yml `
  --query properties.fqdn
```

To update the route configuration later:

```powershell
az containerapp env http-route-config update `
  --http-route-config-name $ROUTE_NAME `
  --resource-group $RESOURCE_GROUP `
  --name $ACA_ENV `
  --yaml infra/azure/routing.yml `
  --query properties.fqdn
```

## Required GitHub Secrets

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `AZURE_RESOURCE_GROUP`
- `AZURE_BACKEND_APP_NAME`
- `AZURE_FRONTEND_APP_NAME`
- `ACR_NAME`
- `ACR_LOGIN_SERVER`
- `AZURE_SQL_DATABASE_URL`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Optional GitHub variable:

- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`

Use federated credentials for GitHub Actions where possible, so no Azure client secret is stored.

## Container App Environment Variables

Backend:

```text
DATABASE_URL=secretref:database-url
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://<route-or-custom-domain>
GPS_SIMULATOR_ENABLED=false
COOKIE_SECURE=true
JWT_SECRET=secretref:jwt-secret
```

Frontend:

```text
BACKEND_URL=https://<backend-container-app-or-route-domain>
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_SOCKET_URL=/
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<browser-restricted-key>
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=<optional-map-id>
NEXT_PUBLIC_ENABLE_GPS_SIMULATOR=false
```

## Migration Procedure

Migrations are not run at container startup.

1. Confirm the production `DATABASE_URL` points to Azure SQL, not local SQL Server and not Neon/PostgreSQL.
2. Confirm `backend/prisma/schema.prisma` still uses `provider = "sqlserver"`.
3. Review `backend/prisma/migrations`.
4. Run the manual GitHub Actions workflow `Azure Prisma Migrate Deploy`.
5. Type `MIGRATE_AZURE_SQL` in the workflow confirmation input.
6. Verify `/api/health` returns `database: "ok"`.

Do not run `prisma migrate reset` on production. Do not copy local SQL Server data unless a separate data migration plan has been approved.

## Deployment Order

1. Create Azure resources.
2. Configure Azure SQL firewall access.
3. Add GitHub secrets and variables.
4. Build and deploy backend image.
5. Run the manual Prisma migration workflow.
6. Build and deploy frontend image.
7. Configure route-based routing or a custom domain.
8. Verify HTTPS, login, REST API, and Socket.IO live GPS.

## Rollback

Container Apps keeps revisions. Roll back to a previous healthy revision:

```powershell
az containerapp revision list --name $BACKEND_APP --resource-group $RESOURCE_GROUP -o table
az containerapp revision list --name $FRONTEND_APP --resource-group $RESOURCE_GROUP -o table

az containerapp revision activate `
  --name $BACKEND_APP `
  --resource-group $RESOURCE_GROUP `
  --revision "<previous-backend-revision>"

az containerapp revision activate `
  --name $FRONTEND_APP `
  --resource-group $RESOURCE_GROUP `
  --revision "<previous-frontend-revision>"
```

Database rollback must be handled with Azure SQL point-in-time restore or a reviewed down-migration plan. Do not reset the database.

## Verification Checklist

- `npx prisma format` passes from `backend`.
- `npx prisma validate` passes from `backend`.
- `npx prisma generate` passes from `backend`.
- `npm run build -w backend` passes.
- `npm run build -w frontend` passes.
- `GET https://<domain>/health` returns frontend health.
- `GET https://<domain>/api/health` returns backend health and database status.
- Login sets a secure `fleet_session` cookie.
- Dashboard API calls use `/api`.
- Socket.IO connects through `/socket.io` over HTTPS.
- GPS simulator is not visible in production.
