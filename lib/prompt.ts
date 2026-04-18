import { type RetrievedLocation } from '@/lib/retrieval';

type PromptInput = {
    userMessage: string;
    contexts: RetrievedLocation[];
    history?: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
};

export function buildTravelSystemPrompt() {
    return [
        'Bạn là trợ lý tư vấn du lịch Đà Lạt.',
        'Ưu tiên thông tin dựa trên context được cung cấp, không tự ý bịa thêm sự thật.',
        'Nếu context chưa đủ, hãy nói rõ giới hạn và hỏi lại thông tin cần thiết (số ngày, ngân sách, số người, sở thích).',
        'Trả lời ngắn gọn, dễ đọc, có gợi ý lịch trình hoặc các lựa chọn cụ thể.',
        'Mặc định trả lời bằng tiếng Việt có dấu.',
    ].join(' ');
}

function buildContextBlock(contexts: RetrievedLocation[]) {
    if (contexts.length === 0) {
        return 'Không có dữ liệu context phù hợp trong bộ dữ liệu địa điểm.';
    }

    return contexts
        .map((item, index) => {
            return [
                `${index + 1}. ${item.name} (${item.category})`,
                `- Địa chỉ: ${item.address}`,
                `- Mô tả: ${item.description ?? 'Không có'}`,
                `- Giờ mở cửa: ${item.openingHours ?? 'Không rõ'}`,
                `- Giá: ${item.priceRange ?? 'Không rõ'}`,
                `- Tips: ${item.tips ?? 'Không có'}`,
            ].join('\n');
        })
        .join('\n\n');
}

function buildHistoryBlock(history: PromptInput['history']) {
    if (!history || history.length === 0) {
        return 'Không có lịch sử hội thoại trước đó.';
    }

    return history
        .map((item) => `${item.role === 'assistant' ? 'Trợ lý' : 'Người dùng'}: ${item.content}`)
        .join('\n');
}

export function buildChatPrompt(input: PromptInput) {
    return [
        `SYSTEM:\n${buildTravelSystemPrompt()}`,
        `LỊCH SỬ GẦN ĐÂY:\n${buildHistoryBlock(input.history)}`,
        `CONTEXT ĐỊA ĐIỂM:\n${buildContextBlock(input.contexts)}`,
        `CÂU HỎI HIỆN TẠI:\n${input.userMessage}`,
        'YÊU CẦU TRẢ LỜI:\n- Trả lời rõ ràng theo gợi ý hành trình hoặc lựa chọn cụ thể.\n- Nếu context thiếu, phải nói rõ và hỏi lại.\n- Không được bịa thông tin ngoài context.',
    ].join('\n\n');
}
