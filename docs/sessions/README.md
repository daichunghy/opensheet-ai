# Host người thật — OpenSheet-AI

**Kết luận:** tuần này Hy là host. Agent không mở Zoom/Meet hộ, không giả tester, không đăng tin công khai khi package còn `private`.

Cách duy nhất hợp lệ **ngay hôm nay**: mời 2–3 người quen gọi Meet 35 phút. Họ không `npm install opensheet-ai` được vì chưa publish.

Hai session local trong `docs/evidence/2026-08-23-quickstart-sessions.md` **không** đếm F3-007.

## Thứ tự mời (làm 1 → 2 → 3)

| Ưu tiên | Ai | Kênh | Gửi tin |
| --- | --- | --- | --- |
| 1 | 2–3 bạn dev đã từng nhờ contribkit / bạn lớp Swinburne / đồng nghiệp biết Node | Zalo / Messenger / email riêng | [INVITE-VI.md](INVITE-VI.md) |
| 2 | 1 người làm Excel/research (marketing, ops) **nếu** họ chịu ngồi cạnh terminal | gọi trực tiếp | cùng tin, nói rõ Hy gõ lệnh |
| 3 | WeBuild Slack, sau khi repo **public** | [webuild.community](https://www.webuild.community/) | [INVITE-EN.md](INVITE-EN.md) — **một** post |
| Không tuần này | Maintainer spreadsheet-kit (`PSU3D0`) / sheets-mcp | GitHub | chỉ khi có câu interoperability cụ thể; không xin “làm tester cho grant” |
| Cấm | Acc phụ, xin star, dán 20 issue, mua tester | — | — |

Mục tiêu tuần này: **2 session**. Spec 5 người ngoài là F3-007, không đốt hết danh sách vì quota 2.

## Host nghĩa là gì

1. Hy đặt lịch (Google Meet / Zoom, 35 phút).
2. Trước giờ: `npm run verify` trên máy Hy.
3. Trong giờ: chạy [PROTOCOL.md](PROTOCOL.md). Ghi [NOTES-TEMPLATE.md](NOTES-TEMPLATE.md) **có đồng ý**.
4. Sau giờ: một file `docs/sessions/notes/YYYY-MM-DD-<tên-viết-tắt>.md`. Không commit tên đầy đủ hay email nếu họ không muốn.

Gói zip cho Mode B: `npm run pack:session` → `opensheet-ai-session.tgz` (không `node_modules`, không `.git`).
