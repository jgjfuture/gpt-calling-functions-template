import OpenAI from 'openai';

const client = new OpenAI();

type GPTCallableFunction = {
    name: string;
    metadata: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function;
    callable: (params: any) => Promise<string>;
};

async function runConversation(
    client: OpenAI,
    conversation: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    functions: GPTCallableFunction[],
    model: string = 'gpt-3.5-turbo',
    max_calls = 10,
    responses: OpenAI.Chat.ChatCompletion[] = [],
): Promise<OpenAI.Chat.ChatCompletion[]> {
    if (max_calls <= 0) {
        return responses;
    }
    const response = await client.chat.completions.create({
        model: model,
        messages: conversation,
        functions: functions.map((f) => f.metadata),
        function_call: 'auto',
    });
    const responseMessage = response.choices[0].message;
    responses.push(response);
    if (responseMessage.function_call) {
        conversation.push(responseMessage);
        const functionName = responseMessage.function_call.name;
        const callable = functions.find((f) => f.name === functionName)
            ?.callable;
        if (callable) {
            const callArgs = JSON.parse(
                responseMessage.function_call.arguments,
            );
            console.debug(`GPT requested call: ${functionName}(%o)`, callArgs);
            try {
                const functionResponse = await callable(callArgs);
                console.debug(
                    `Actual function returns: ${functionName}(%o) => ${functionResponse}`,
                    callArgs,
                );
                conversation.push({
                    role: 'function',
                    name: functionName,
                    content: functionResponse,
                });
            } catch (e) {
                console.error(
                    `Actual function throws: ${functionName}(%o) => ${e}`,
                    callArgs,
                );
                console.error(e);
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
        return await runConversation(
            client,
            conversation,
            functions,
            model,
            max_calls - 1,
            responses,
        );
    } else {
        return responses;
    }
}

const r = await runConversation(
    client,
    [
        {
            role: 'system',
            content: 'あなたはアナウンサーです。',
        },
        {
            role: 'user',
            content: '渡された情報をもとに、報道を行ってください。',
        },
    ],
    [
        {
            name: 'get_news',
            metadata: {
                name: 'get_news',
                description: 'Get news from the news API',
                parameters: {
                    type: 'object',
                    properties: {
                        seed: {
                            type: 'number',
                            description: 'random seed. from 0 to 100',
                        },
                    },
                    required: ['seed'],
                },
            },
            callable: async (params: { seed: number }) => {
                // dummy implementation
                if (params.seed < 50) return '明日の天気は晴れです。';
                return '明日の天気は雨です。';
            },
        },
    ],
);

console.log(r.map((sr) => sr.choices[0].message));
