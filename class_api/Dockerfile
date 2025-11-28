# build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY class_api/class_api.csproj class_api/
COPY class_shared/class_shared.csproj class_shared/
RUN dotnet restore class_api/class_api.csproj

COPY class_api/ class_api/
COPY class_shared/ class_shared/
WORKDIR /src/class_api
RUN dotnet publish -c Release -o /app/publish

# runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "class_api.dll"]
