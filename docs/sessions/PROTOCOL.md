# Protocol 35 phút

**Mode A (tuần này):** Hy share màn hình, khách nói.  
**Mode B:** khách clone tag public, cài dependencies trong clone của họ rồi tự gõ; Hy hỗ trợ.

```bash
git clone --branch v0.1.0-alpha.5 https://github.com/daichunghy/opensheet-ai.git /tmp/opensheet-ai-session
cd /tmp/opensheet-ai-session
npm ci
npm run build
```

Có thể dùng public npm package trong một thư mục consumer riêng nếu không cần chạy các file example trong repository. Không dùng đường dẫn local của maintainer. Walkthrough này là usability feedback, chưa phải bằng chứng external adoption.

Package nhắm Node 20 hoặc 22 theo `engines`.

## 0:00–0:03 đồng ý

Đọc [CONSENT.md](CONSENT.md). Hỏi: ghi chú có/không, ghi hình có/không. Không đồng ý → dừng, không session.

## 0:03–0:08 bối cảnh (không demo code)

Một câu: “Agent muốn sửa Excel. Tool này bắt intent JSON thành plan, chặn formula mặc định, in receipt, mới ghi file.”

Không nói grant, npm, “middleware”.

## 0:08–0:28 khách dẫn

Hy **không** giải thích trước từng cờ. Hỏi: “Bạn muốn chạy lệnh nào trước?”

Lệnh tối thiểu (Hy gõ nếu Mode A):

```bash
cd /tmp/opensheet-ai-session
node dist/cli.js compile examples/kpi-threshold.json
node dist/cli.js compile examples/scale-bank.json > /tmp/os-plan.json
node dist/cli.js validate /tmp/os-plan.json
node dist/cli.js apply-memory /tmp/os-plan.json
node dist/cli.js apply-xlsx /tmp/os-plan.json --out /tmp/os.xlsx --apply
```

Mở `/tmp/os.xlsx` bằng Excel/Numbers nếu có.

Ghi: lệnh nào họ do dự, họ có đọc `--apply` không, họ có hỏi Google Sheets không.

## 0:28–0:33 ma sát

Hỏi đúng 3 câu:

1. Chỗ nào bạn suýt bỏ?
2. Việc này có đáng một package riêng, hay nên nhét vào MCP Excel có sẵn?
3. Bạn có viết adapter không, hay chỉ cần CLI?

## 0:33–0:35 đóng

Cảm ơn. Không xin star. Hẹn gửi 5 dòng tóm tắt nếu họ muốn.

**Pass:** họ hoàn thành compile → validate → dry-run receipt → file xlsx, **không** cần Hy gợi lệnh (Mode B) hoặc họ chỉ đường cho Hy gõ (Mode A). Kết quả này vẫn chỉ là walkthrough feedback, không phải adoption evidence.
