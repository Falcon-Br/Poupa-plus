# syntax=docker/dockerfile:1
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY PoupaPlus.Domain/PoupaPlus.Domain.csproj PoupaPlus.Domain/
COPY PoupaPlus.Api/PoupaPlus.Api.csproj PoupaPlus.Api/
RUN dotnet restore PoupaPlus.Api/PoupaPlus.Api.csproj

COPY . .
RUN dotnet publish PoupaPlus.Api/PoupaPlus.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "PoupaPlus.Api.dll"]

