# Sao lưu PostgreSQL và tệp tải lên

Service `backup` trong `compose.yaml` chạy ngay khi khởi động, sau đó chạy lại theo `BACKUP_INTERVAL_SECONDS`. Mỗi bản sao lưu nằm trong `backups/english_center_YYYYMMDD_HHMMSS/` và gồm:

- `database.dump`: PostgreSQL dạng custom;
- `uploads.tar.gz`: toàn bộ PDF, Word, Excel và ảnh đã tải lên;
- `SHA256SUMS`: checksum để phát hiện bản sao lưu hỏng.

Các bản cũ hơn `BACKUP_RETENTION_DAYS` được tự động xóa. Thư mục `backups/` đã được loại khỏi Git. Production phải đồng bộ ít nhất một bản mỗi ngày sang nơi khác VPS.

Khôi phục trong môi trường bảo trì:

```bash
export DATABASE_URL='postgresql://user:password@database:5432/english_center'
export UPLOAD_DIR='/uploads'
./restore.sh /backups/english_center_20261029_020000
```

`restore.sh` kiểm tra checksum trước, sau đó ghi đè database và giải nén tệp. Luôn thử khôi phục trên một môi trường riêng trước ngày vận hành thật.
