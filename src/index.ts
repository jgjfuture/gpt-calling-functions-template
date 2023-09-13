import OpenAI from 'openai';

const client = new OpenAI();

type GPTCallableFunction = {
    name: string;
    metadata: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function;
    callable: (params: unknown) => Promise<string>;
};

async function runConversation(
    client: OpenAI,
    conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    functions: GPTCallableFunction[],
): Promise<OpenAI.Chat.ChatCompletion> {
    const response = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: conversation,
        functions: functions.map((f) => f.metadata),
        function_call: 'auto',
    });
    const responseMessage = response.choices[0].message;
    if (responseMessage.function_call) {
        conversation.push(responseMessage);
        const functionName = responseMessage.function_call.name;
        const callable = functions.find((f) => f.name === functionName)
            ?.callable;
        if (callable) {
            const callArgs = JSON.parse(
                responseMessage.function_call.arguments,
            );
            console.log(callArgs);
            try {
                const functionResponse = await callable(callArgs);
                console.log(functionResponse);
                conversation.push({
                    role: 'function',
                    name: functionName,
                    content: functionResponse,
                });
            } catch (e) {
                console.log(e);
                conversation.push({
                    role: 'function',
                    name: functionName,
                    content: 'Error: Exception thrown while running function',
                });
            }
        } else {
            conversation.push({
                role: 'function',
                name: functionName,
                content: 'Error: Function not found',
            });
        }
        return await runConversation(client, conversation, functions);
    } else {
        return response;
    }
}

const r = await runConversation(
    client,
    [
        {
            role: 'system',
            content: '',
        },
        {
            role: 'user',
            content: '',
        },
    ],
    [],
);
console.log(r);
console.log(r.choices[0].message);
