using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using class_api.Application.Interfaces;
using Microsoft.Extensions.Configuration;

namespace class_api.Services
{
    public class AzureStorage : IStorage
    {
        private readonly BlobContainerClient _container;

        public AzureStorage(IConfiguration cfg)
        {
            var connStr = cfg["Azure:ConnectionString"];
            var containerName = cfg["Azure:ContainerName"];

            _container = new BlobContainerClient(connStr, containerName);

            _container.CreateIfNotExists();
        }
        public async Task<(string key, long sizeBytes)> UploadAsync(
            Stream stream,
            string contentType,
            string keyPrefix,
            string fileName,
            CancellationToken ct = default
        )
        {
            var safeName = Path.GetFileName(fileName);
            // Human-readable key: prefix/yyyyMMdd-HHmmss-filename
            var key = $"{keyPrefix.TrimEnd('/')}/{DateTime.UtcNow:yyyyMMdd-HHmmss}-{safeName}";

            var blobClient = _container.GetBlobClient(key);

            await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);

            return (key, stream.Length);
        }
        public string GetTemporaryUrl(string key, int expiresInMinutes = 10080)
        {
            var blobClient = _container.GetBlobClient(key);

            if (!_container.CanGenerateSasUri)
                throw new InvalidOperationException("Container does not support SAS token generation. Check your connection string and permissions.");

            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = _container.Name,
                BlobName = key,
                Resource = "b",
                ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(expiresInMinutes)
            };
            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            var sasUri = blobClient.GenerateSasUri(sasBuilder);
            return sasUri.ToString();
        }

        public string PublicUrl(string key)
        {
            return $"{_container.Uri}/{key}";
        }

        public async Task DeleteAsync(string key, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(key)) return;
            try
            {
                var blobClient = _container.GetBlobClient(key);
                await blobClient.DeleteIfExistsAsync(DeleteSnapshotsOption.IncludeSnapshots, cancellationToken: ct);
            }
            catch
            {
            }
        }

        public async Task<List<(string key, long sizeBytes)>> ListAsync(string prefix, CancellationToken ct = default)
        {
            var list = new List<(string, long)>();
            await foreach (var blob in _container.GetBlobsAsync(prefix: prefix, cancellationToken: ct))
            {
                list.Add((blob.Name, blob.Properties.ContentLength ?? 0));
            }
            return list;
        }

        public async Task UploadTextAsync(string key, string text, string contentType = "application/json", CancellationToken ct = default)
        {
            var blobClient = _container.GetBlobClient(key);
            using var ms = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(text));
            await blobClient.UploadAsync(ms, new BlobHttpHeaders { ContentType = contentType }, cancellationToken: ct);
        }

        public async Task<string?> ReadTextAsync(string key, CancellationToken ct = default)
        {
            var blobClient = _container.GetBlobClient(key);
            if (!await blobClient.ExistsAsync(ct)) return null;
            var resp = await blobClient.DownloadContentAsync(ct);
            return resp.Value.Content.ToString();
        }
    }
}
