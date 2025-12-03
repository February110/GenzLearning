FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["class_worker/class_worker.csproj", "class_worker/"]
COPY ["class_shared/class_shared.csproj", "class_shared/"]
RUN dotnet restore "class_worker/class_worker.csproj"
COPY . .
WORKDIR "/src/class_worker"
RUN dotnet publish "class_worker.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "class_worker.dll"]
