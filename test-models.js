require('dotenv').config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ Thiếu GEMINI_API_KEY. Hãy thêm key vào file .env.local");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // Thử cách gọi trực tiếp từ client
        const result = await genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Nếu không gọi được listModels, ta sẽ dùng lệnh cURL thần thánh 
        // vì đôi khi SDK bị lỗi node_modules
        console.log("🚀 Đang kiểm tra danh sách model qua API...");

        // Cách 2: Gọi trực tiếp qua Fetch (Không phụ thuộc SDK)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.models) {
            console.log("✅ DANH SÁCH MODEL CHUẨN TỪ GOOGLE:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`👉 ID: ${m.name.replace('models/', '')}`);
                }
            });
        } else {
            console.log("❌ Không lấy được danh sách. Phản hồi từ Google:", data);
        }

    } catch (error) {
        console.error("❌ Lỗi hệ thống:", error.message);
    }
}

listModels();