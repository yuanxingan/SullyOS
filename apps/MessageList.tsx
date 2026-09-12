import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useOS } from '../context/OSContext';
import { Message, CharacterProfile } from '../types';
import { DB } from '../utils/db';
import TokenImg from '../components/os/TokenImg';
import { MagnifyingGlass, CaretLeft, ChatCircleDots, PushPin, PushPinSlash, Trash } from '@phosphor-icons/react';

const PINNED_CONVERSATIONS_KEY = 'sully-os.message-list.pins.v1';
const DELETED_CONVERSATIONS_KEY = 'sully-os.message-list.hidden.v1';

const readStringMap = (key: string): Record<string, number> => {
    try {
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
        return {};
    }
};

const readPinnedIds = (): string[] => {
    try {
        const value = JSON.parse(localStorage.getItem(PINNED_CONVERSATIONS_KEY) || '[]');
        return Array.isArray(value) ? value.filter(id => typeof id === 'string') : [];
    } catch {
        return [];
    }
};

interface ConversationSummary {
    charId: string;
    charName: string;
    charAvatar: string;
    lastMessage: Message | null;
    lastMessageTime: number;
    messageCount: number;
    unreadCount: number;
}

const SWIPE_ACTION_WIDTH = 88;

const ConversationRow: React.FC<{
    conv: ConversationSummary;
    pinned: boolean;
    open: boolean;
    onOpenChange: (charId: string | null) => void;
    onSelect: () => void;
    onTogglePin: () => void;
    onDelete: () => void;
    formatTime: (timestamp: number) => string;
    getMessagePreview: (message: Message | null) => string;
}> = ({ conv, pinned, open, onOpenChange, onSelect, onTogglePin, onDelete, formatTime, getMessagePreview }) => {
    const [offset, setOffset] = useState(0);
    const [dragging, setDragging] = useState(false);
    const offsetRef = useRef(0);
    const dragRef = useRef<{ x: number; y: number; offset: number; moved: boolean } | null>(null);
    const suppressClickRef = useRef(false);

    const applyOffset = (next: number) => {
        const clamped = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, next));
        offsetRef.current = clamped;
        setOffset(clamped);
    };

    useEffect(() => {
        if (!open && offsetRef.current !== 0) {
            offsetRef.current = 0;
            setOffset(0);
        }
    }, [open]);

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        dragRef.current = { x: event.clientX, y: event.clientY, offset: offsetRef.current, moved: false };
        setDragging(true);
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragRef.current;
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.abs(dy) > Math.abs(dx) * 1.2 && Math.abs(dy) > 8) {
            dragRef.current = null;
            setDragging(false);
            return;
        }
        if (Math.abs(dx) > 6) drag.moved = true;
        if (!drag.moved) return;
        applyOffset(drag.offset + dx);
    };

    const handlePointerUp = () => {
        const drag = dragRef.current;
        dragRef.current = null;
        setDragging(false);
        if (!drag) return;
        const next = Math.abs(offsetRef.current) > SWIPE_ACTION_WIDTH / 2 ? -SWIPE_ACTION_WIDTH : 0;
        applyOffset(next);
        onOpenChange(next < 0 ? conv.charId : null);
        if (drag.moved) suppressClickRef.current = true;
    };

    const handleClick = () => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        if (open) {
            onOpenChange(null);
            return;
        }
        onSelect();
    };

    return (
        <div className="sully-message-row relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white/85 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]">
            {open && (
                <div className="sully-message-actions absolute inset-y-0 right-0 flex w-[88px]">
                <button
                    onClick={onTogglePin}
                    className={`flex-1 transition-colors ${pinned ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-500'}`}
                    title={pinned ? '取消置顶' : '置顶'}
                    aria-label={pinned ? '取消置顶' : '置顶'}
                >
                    <div className="flex flex-col items-center gap-1 text-[10px] font-bold">
                        {pinned ? <PushPin className="w-4 h-4" weight="fill" /> : <PushPinSlash className="w-4 h-4" />}
                        <span>{pinned ? '取消' : '置顶'}</span>
                    </div>
                </button>
                <button
                    onClick={onDelete}
                    className="flex-1 bg-rose-50 text-rose-500 transition-colors hover:bg-rose-100"
                    title="删除对话"
                    aria-label="删除对话"
                >
                    <div className="flex flex-col items-center gap-1 text-[10px] font-bold">
                        <Trash className="w-4 h-4" />
                        <span>删除</span>
                    </div>
                </button>
            </div>
            )}

            <div
                role="button"
                tabIndex={0}
                onClick={handleClick}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleClick();
                    }
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="sully-message-content relative z-10 flex h-full min-h-[74px] items-center gap-3 bg-white/90 px-3.5 py-3 text-left"
                style={{
                    transform: `translateX(${offset}px)`,
                    touchAction: 'pan-y',
                    transition: dragging ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                    willChange: 'transform',
                }}
            >
                <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-[18px] overflow-hidden bg-gradient-to-br from-violet-100 to-purple-100 border border-white shadow-inner ring-1 ring-slate-200/50">
                        <TokenImg value={conv.charAvatar} className="w-full h-full object-cover" alt={conv.charName} />
                    </div>
                    {conv.unreadCount > 0 && (
                        <div className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1.5 bg-rose-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg border-2 border-white">
                            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                        {pinned && <PushPin className="w-3 h-3 text-violet-500 shrink-0" weight="fill" />}
                        <h3 className="font-semibold text-slate-900 truncate text-[15px] leading-none">{conv.charName}</h3>
                    </div>
                    <p className="text-xs text-slate-500 truncate leading-5">{getMessagePreview(conv.lastMessage)}</p>
                </div>

                <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatTime(conv.lastMessageTime)}</span>
            </div>
        </div>
    );
};

const MessageList: React.FC<{ onSelectCharacter: (charId: string) => void; onClose: () => void }> = ({ onSelectCharacter, onClose }) => {
    const { characters, unreadMessages, clearUnread, theme } = useOS();
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [pinnedIds, setPinnedIds] = useState<string[]>(readPinnedIds);
    const [hiddenAt, setHiddenAt] = useState<Record<string, number>>(() => readStringMap(DELETED_CONVERSATIONS_KEY));
    const [deleteTarget, setDeleteTarget] = useState<ConversationSummary | null>(null);
    const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

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

                summaries.sort((a, b) => {
                    const aPinned = pinnedIds.includes(a.charId) ? 1 : 0;
                    const bPinned = pinnedIds.includes(b.charId) ? 1 : 0;
                    if (aPinned !== bPinned) return bPinned - aPinned;
                    return b.lastMessageTime - a.lastMessageTime;
                });
                setConversations(summaries);
            } catch (error) {
                console.error('Failed to load conversations:', error);
            } finally {
                setLoading(false);
            }
        };

        loadConversations();
    }, [characters, unreadMessages, pinnedIds]);

    // 过滤对话
    const filteredConversations = useMemo(() => {
        const q = searchQuery.toLowerCase();
        return conversations.filter(
            conv => {
                const deletedAt = hiddenAt[conv.charId];
                const isVisibleAfterDelete = !deletedAt
                    || pinnedIds.includes(conv.charId)
                    || conv.lastMessageTime > deletedAt
                    || conv.unreadCount > 0;
                if (!isVisibleAfterDelete) return false;
                if (!searchQuery.trim()) return true;
                return conv.charName.toLowerCase().includes(q) ||
                        conv.lastMessage?.content.toLowerCase().includes(q);
            }
        );
    }, [conversations, searchQuery, hiddenAt, pinnedIds]);

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

    const persistPinnedIds = (nextIds: string[]) => {
        localStorage.setItem(PINNED_CONVERSATIONS_KEY, JSON.stringify(nextIds));
        setPinnedIds(nextIds);
    };

    const togglePinned = (charId: string) => {
        const nextIds = pinnedIds.includes(charId)
            ? pinnedIds.filter(id => id !== charId)
            : [...pinnedIds, charId];
        persistPinnedIds(nextIds);
    };

    const deleteConversation = useCallback(async () => {
        if (!deleteTarget) return;
        const deletedAt = Date.now();

        try {
            await DB.clearMessages(deleteTarget.charId);
            const nextHiddenAt = { ...hiddenAt, [deleteTarget.charId]: deletedAt };
            localStorage.setItem(DELETED_CONVERSATIONS_KEY, JSON.stringify(nextHiddenAt));
            setHiddenAt(nextHiddenAt);
            persistPinnedIds(pinnedIds.filter(id => id !== deleteTarget.charId));
            setConversations(prev => prev.filter(conv => conv.charId !== deleteTarget.charId));
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        } finally {
            setDeleteTarget(null);
        }
    }, [deleteTarget, hiddenAt, pinnedIds]);

    return (
        <div className="sully-message-list relative flex flex-col h-full bg-gradient-to-br from-slate-50 via-white to-violet-50/70">
            {theme.messageListCustomCss && <style>{theme.messageListCustomCss}</style>}
            <div className="px-4 pt-[max(0.85rem,env(safe-area-inset-top))] pb-4 bg-white/75 backdrop-blur-xl border-b border-slate-200/60 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.45)]">
                <div className="flex items-center gap-2.5 mb-4">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="返回"
                    >
                        <CaretLeft className="w-5 h-5 text-slate-600" weight="bold" />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900 tracking-tight">消息</h1>
                </div>
                {/* 搜索框 */}
                <div className="relative">
                    <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="搜索对话或消息..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-slate-100/90 rounded-xl text-sm text-slate-800 placeholder-slate-400 border border-transparent focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-200 transition-all"
                    />
                </div>
            </div>

            {/* 对话列表 */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="p-4 space-y-3">
                        {[0, 1, 2].map(index => (
                            <div key={index} className="h-[74px] bg-white/70 rounded-2xl border border-slate-200/60 animate-pulse" />
                        ))}
                    </div>
                ) : filteredConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200/60 flex items-center justify-center text-violet-300">
                            <ChatCircleDots className="w-8 h-8" weight="duotone" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-slate-600">
                            {conversations.length === 0 ? '暂无对话' : '未找到匹配的对话'}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                            {conversations.length === 0 ? '去桌面打开 Message 开始聊天吧' : '换个关键词试试'}
                        </p>
                    </div>
                ) : (
                    <div className="p-3 space-y-2.5">
                        {filteredConversations.map((conv) => (
                            <ConversationRow
                                key={conv.charId}
                                conv={conv}
                                pinned={pinnedIds.includes(conv.charId)}
                                open={openSwipeId === conv.charId}
                                onOpenChange={setOpenSwipeId}
                                onSelect={() => handleSelectConversation(conv.charId)}
                                onTogglePin={() => togglePinned(conv.charId)}
                                onDelete={() => setDeleteTarget(conv)}
                                formatTime={formatTime}
                                getMessagePreview={getMessagePreview}
                            />
                        ))}
                    </div>
                )}
            </div>

            {deleteTarget && (
                <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-white/60 p-5">
                        <h3 className="text-base font-bold text-slate-900">删除对话</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            将删除与「{deleteTarget.charName}」的私聊记录，并从列表中隐藏。角色、人设和云端设置不会被删除；收到新消息时会重新出现。
                        </p>
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all"
                            >
                                取消
                            </button>
                            <button
                                onClick={deleteConversation}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all shadow-sm"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MessageList;
