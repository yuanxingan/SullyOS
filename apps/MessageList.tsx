import React, { useState, useEffect, useMemo } from 'react';
import { useOS } from '../context/OSContext';
import { Message, CharacterProfile } from '../types';
import { DB } from '../utils/db';
import TokenImg from '../components/os/TokenImg';
import { MagnifyingGlass, CaretLeft } from '@phosphor-icons/react';

interface ConversationSummary {
    charId: string;
    charName: string;
    charAvatar: string;
    lastMessage: Message | null;
    lastMessageTime: number;
    messageCount: number;
    unreadCount: number;
}

const MessageList: React.FC<{ onSelectCharacter: (charId: string) => void; onClose: () => void }> = ({ onSelectCharacter, onClose }) => {
    const { characters, unreadMessages, clearUnread } = useOS();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // 加载所有对话摘要
    useEffect(() => {
        const loadConversations = async () => {
            try {
                setLoading(true);
                const summaries: ConversationSummary[] = [];

                for (const char of characters) {
                    const messages = await DB.getMessagesByCharId(char.id);
                    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
                    
                    // 计算该角色的未读数
                    const unreadCount = unreadMessages[char.id] || 0;

                    summaries.push({
                        charId: char.id,
                        charName: char.name,
                        charAvatar: char.avatar,
                        lastMessage: lastMsg,
                        lastMessageTime: lastMsg?.timestamp || 0,
                        messageCount: messages.length,
                        unreadCount,
                    });
                }

                // 按最后消息时间倒序排列
                summaries.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
                setConversations(summaries);
            } catch (error) {
                console.error('Failed to load conversations:', error);
            } finally {
                setLoading(false);
            }
        };

        loadConversations();
    }, [characters, unreadMessages]);

    // 过滤对话
    const filteredConversations = useMemo(() => {
        if (!searchQuery.trim()) return conversations;
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            conv => conv.charName.toLowerCase().includes(q) ||
                    conv.lastMessage?.content.toLowerCase().includes(q)
        );
    }, [conversations, searchQuery]);

    // 格式化时间显示
    const formatTime = (timestamp: number) => {
        const now = new Date();
        const msgDate = new Date(timestamp);
        const diffMs = now.getTime() - msgDate.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays === 1) return '昨天';
        if (diffDays < 7) return `${diffDays} 天前`;
        return msgDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    // 提取消息预览文本
    const getMessagePreview = (msg: Message | null) => {
        if (!msg) return '暂无对话';
        const content = msg.content.replace(/[\r\n]+/g, ' ').substring(0, 50);
        const prefix = msg.role === 'user' ? '你: ' : '';
        return prefix + content + (msg.content.length > 50 ? '...' : '');
    };

    // 处理对话项点击
    const handleSelectConversation = (charId: string) => {
        clearUnread(charId);
        onSelectCharacter(charId);
    };

    return (
        <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-slate-100">
            {/* 顶栏 */}
            <div className="px-4 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-200/50">
                <div className="flex items-center gap-3 mb-3">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="返回"
                    >
                        <CaretLeft className="w-5 h-5 text-slate-600" weight="bold" />
                    </button>
                    <h1 className="text-lg font-bold text-slate-800">消息</h1>
                </div>
                {/* 搜索框 */}
                <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索对话或消息..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-100 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300"
                    />
                </div>
            </div>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="text-slate-400 text-sm">加载中...</div>
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                        <div className="text-sm">
                            {conversations.length === 0 ? '暂无对话' : '未找到匹配的对话'}
                        </div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200/50">
                        {filteredConversations.map((conv) => (
                            <button
                                key={conv.charId}
                                onClick={() => handleSelectConversation(conv.charId)}
                                className="w-full px-4 py-3 hover:bg-white/60 active:bg-white/40 transition-colors text-left flex items-center gap-3 group"
                            >
                                {/* 头像 */}
                                <div className="relative shrink-0">
                                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-violet-100 to-purple-100 border border-slate-200/50">
                                        <TokenImg
                                            value={conv.charAvatar}
                                            className="w-full h-full object-cover"
                                            alt={conv.charName}
                                        />
                                    </div>
                                    {/* 未读红点 */}
                                    {conv.unreadCount > 0 && (
                                        <div className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg">
                                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                                        </div>
                                    )}
                                </div>

                                {/* 对话信息 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                        <h3 className="font-semibold text-slate-800 truncate">
                                            {conv.charName}
                                        </h3>
                                        <span className="text-xs text-slate-400 shrink-0">
                                            {formatTime(conv.lastMessageTime)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">
                                        {getMessagePreview(conv.lastMessage)}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MessageList;
