import { Mistral } from "@mistralai/mistralai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.MISTRAL_API_KEY || "your_api_key";

const mistralClient = new Mistral({ apiKey: apiKey });

// async function main() {
//     const chatResponse = await client.chat.complete({
//         model: "mistral-large-latest",
//         messages: [{role: 'user', content: 'What is forkai.tech'}]
//     });

//     console.log(JSON.stringify(chatResponse, null, 2));
// }

// main();

export { mistralClient };
