# Prompt Audit Report

> **Ngôn ngữ / Language:** Tiếng Việt  
> **Timezone:** Asia/Bangkok  
> **Tác vụ:** prompt_audit_report  
> **Thời điểm tạo báo cáo:** 2026-03-02 (UTC+7)

---

## Phạm vi & nguồn dữ liệu

- **Nguồn dữ liệu:** Conversation transcript được cung cấp qua trường `input.conversation_transcript`.
- **Phạm vi audit:** Toàn bộ prompt của user trong transcript; các prompt liên tiếp cùng ngữ cảnh/challenge được gom lại thành một mục.
- **Trạng thái dữ liệu đầu vào:** ⚠️ `conversation_transcript` **trống** — không có nội dung transcript nào được cung cấp.

> Theo quy tắc trung thực: nếu thiếu transcript thì phải ghi rõ **"không đủ transcript để trích output"** và không suy đoán.  
> Toàn bộ phần audit bên dưới phản ánh tình trạng này.

---

## Prompt-by-prompt audit

> **Không đủ transcript để trích output.**  
> Trường `conversation_transcript` được truyền vào là chuỗi rỗng (`""`). Không có prompt nào của user có thể được trích xuất, phân tích hay đánh giá.

Không có mục nào để liệt kê.

---

## Tổng kết nhanh

| Chỉ số | Giá trị |
|--------|---------|
| Tổng số prompt đã audit | 0 |
| Hoàn thành 100% | 0 |
| Hoàn thành 70% | 0 |
| Hoàn thành 40% | 0 |
| Hoàn thành 0% | 0 |
| Trung bình completion | N/A |

> Không thể tính toán bất kỳ chỉ số nào do thiếu transcript.

---

## Hạn chế & đề xuất cải thiện

- **Hạn chế chính:** Trường `conversation_transcript` bị trống. Toàn bộ báo cáo này không thể cung cấp nội dung audit thực chất.
- **Đề xuất:**
  - Cung cấp nội dung transcript đầy đủ trong trường `input.conversation_transcript` để có thể thực hiện audit.
  - Transcript nên bao gồm toàn bộ các lượt trao đổi (user ↔ assistant), kèm timestamp nếu có.
  - Sau khi có transcript hợp lệ, chạy lại tác vụ để nhận báo cáo đầy đủ với tất cả các trường: `id`, `time_if_available`, `context`, `user_prompt_verbatim_or_excerpt`, `assistant_output_summary`, `optimizations_or_improvements`, `completion_percent`, `remaining_limitations_and_next_steps`.
