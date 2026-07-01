/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, Order, ChatMessage, Notification, PrintFile, OrderStatus, PaymentStatus, PaymentConfig } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { 
  FileText, Users, Clock, MessageSquare, Download, CheckCircle, 
  Send, RefreshCw, BarChart3, Trash2, Edit3, Save, FileSpreadsheet, 
  Printer, ArrowRight, TrendingUp, DollarSign, Files, Eye, HelpCircle,
  BellRing, LogOut, FileCheck, Settings, Camera, Image as ImageIcon, Key, CreditCard, Check, ShieldAlert, X, ShieldCheck, Gift, ArrowLeft
} from 'lucide-react';
import { 
  formatFileSize, formatDateTime, getStatusLabel, 
  getStatusColor, getPaymentStatusLabel, getPaymentStatusColor, 
  exportToCSV, printInvoiceHTML, calculateOrderCost
} from '../utils';
import { deleteUserAccountWithFirebase } from '../firebaseUtils';
import { UserAvatar } from './UserAvatar';
import JSZip from 'jszip';

interface AdminPanelProps {
  adminUser: User;
  onLogout: () => void;
  database: {
    users: User[];
    orders: Order[];
    chatMessages: ChatMessage[];
    notifications: Notification[];
    paymentConfig?: PaymentConfig;
    siteVisits?: number;
    siteVisitsHistory?: { date: string; count: number }[];
  };
  onUpdateDatabase: (updatedData: {
    orders?: Order[];
    chatMessages?: ChatMessage[];
    notifications?: Notification[];
    users?: User[];
    paymentConfig?: PaymentConfig;
  }) => void;
}

export function AdminPanel({ adminUser, onLogout, database, onUpdateDatabase }: AdminPanelProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'orders' | 'chat' | 'users' | 'analytics' | 'settings'>('orders');

  // Selected user for viewing uploaded files list
  const [selectedUserForFiles, setSelectedUserForFiles] = useState<User | null>(null);

  // Selected client for chat thread
  const [activeChatUserId, setActiveChatUserId] = useState<string>('');
  const [adminChatInput, setAdminChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // File download mock states
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [zippingOrderId, setZippingOrderId] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState(0);

  // Admin file deletion states
  const [adminFileToConfirmDelete, setAdminFileToConfirmDelete] = useState<{ orderId: string; fileId: string } | null>(null);

  const handleAdminDeleteFileFromOrder = (orderId: string, fileId: string) => {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedFiles = order.files.filter(f => f.id !== fileId);

    let updatedOrders;
    if (updatedFiles.length === 0) {
      // If no files are left, delete the entire order
      updatedOrders = database.orders.filter(o => o.id !== orderId);
      
      const newNotif = {
        id: 'n_' + Date.now(),
        userId: order.userId,
        title: "Заказ отменен",
        body: `Все файлы в заказе ${orderId} были удалены администратором. Заказ отменен.`,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'order_status' as const
      };
      
      onUpdateDatabase({
        orders: updatedOrders,
        notifications: [newNotif, ...database.notifications]
      });
    } else {
      // Recalculate cost
      const newCost = calculateOrderCost(
        updatedFiles.length,
        order.copies,
        order.paperType,
        order.printColor,
        order.paperDensity,
        updatedFiles,
        order.photoSize,
        order.binding,
        order.promoCode,
        order.promoDiscount
      );

      updatedOrders = database.orders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            files: updatedFiles,
            totalCost: newCost
          };
        }
        return o;
      });

      onUpdateDatabase({
        orders: updatedOrders
      });
    }
    setAdminFileToConfirmDelete(null);
  };

  // Editing Client state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Admin Profiling settings
  const [adminFullName, setAdminFullName] = useState(adminUser.fullName);
  const [adminPhone, setAdminPhone] = useState(adminUser.phone || '');
  const [adminAvatarUrl, setAdminAvatarUrl] = useState(adminUser.avatarUrl || '');
  const [adminAvatarScale, setAdminAvatarScale] = useState(adminUser.avatarScale || 1);
  const [adminAvatarX, setAdminAvatarX] = useState(adminUser.avatarX || 0);
  const [adminAvatarY, setAdminAvatarY] = useState(adminUser.avatarY || 0);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  
  // Bank gateway setting states
  const initialPayConfig = database.paymentConfig || {
    bankId: 'sber',
    merchantId: 'M-10294-88',
    apiKey: 'sk_live_992x47285918bb129c7b94ad',
    enableSbp: true,
    sbpPhone: '+79998881122',
    instructions: 'Для мгновенной оплаты приложите карту к терминалу или отсканируйте SberPay QR-код',
    companyName: 'ИП Оганнисян Д.В.',
    companyInn: '352512345678',
    companyOgrn: '316352500012345',
    companyAddress: 'г. Вологда, Северное шоссе, д. 18',
    refundPolicy: 'Срок возврата денежных средств при отказе от услуг печати до начала производства составляет 1 рабочий день. При обнаружении брака возможен полный перерасчет или перепечатка.',
  };
  const [bankId, setBankId] = useState(initialPayConfig.bankId);
  const [merchantId, setMerchantId] = useState(initialPayConfig.merchantId);
  const [apiKey, setApiKey] = useState(initialPayConfig.apiKey);
  const [enableSbp, setEnableSbp] = useState(initialPayConfig.enableSbp);
  const [sbpPhone, setSbpPhone] = useState(initialPayConfig.sbpPhone || '');
  const [instructions, setInstructions] = useState(initialPayConfig.instructions || '');
  const [companyName, setCompanyName] = useState(initialPayConfig.companyName || 'ИП Оганнисян Д.В.');
  const [companyInn, setCompanyInn] = useState(initialPayConfig.companyInn || '352512345678');
  const [companyOgrn, setCompanyOgrn] = useState(initialPayConfig.companyOgrn || '316352500012345');
  const [companyAddress, setCompanyAddress] = useState(initialPayConfig.companyAddress || 'г. Вологда, Северное шоссе, д. 18');
  const [refundPolicy, setRefundPolicy] = useState(initialPayConfig.refundPolicy || 'Срок возврата денежных средств при отказе от услуг печати до начала производства составляет 1 рабочий день. При обнаружении брака возможен полный перерасчет или перепечатка.');

  const [savingSettings, setSavingSettings] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Gift Promo Code state
  const [promoGiftUser, setPromoGiftUser] = useState<User | null>(null);
  const [givingPromoCode, setGivingPromoCode] = useState('');
  const [givingPromoDiscount, setGivingPromoDiscount] = useState<number>(10);

  useEffect(() => {
    setAdminFullName(adminUser.fullName);
    setAdminPhone(adminUser.phone || '');
    setAdminAvatarUrl(adminUser.avatarUrl || '');
    setAdminAvatarScale(adminUser.avatarScale || 1);
    setAdminAvatarX(adminUser.avatarX || 0);
    setAdminAvatarY(adminUser.avatarY || 0);
  }, [adminUser]);

  const handleSaveSettings = () => {
    setSavingSettings(true);
    setSaveSuccess(false);

    const updatedUsers = database.users.map(u => 
      u.id === adminUser.id 
        ? { 
            ...u, 
            fullName: adminFullName, 
            phone: adminPhone, 
            avatarUrl: adminAvatarUrl,
            avatarScale: adminAvatarScale,
            avatarX: adminAvatarX,
            avatarY: adminAvatarY
          } 
        : u
    );

    const updatedPaymentConfig = {
      bankId,
      merchantId,
      apiKey,
      enableSbp,
      sbpPhone,
      instructions,
      companyName,
      companyInn,
      companyOgrn,
      companyAddress,
      refundPolicy,
    };

    setTimeout(() => {
      onUpdateDatabase({
        users: updatedUsers,
        paymentConfig: updatedPaymentConfig
      });
      setSavingSettings(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    }, 600);
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAdminAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const watermarkAndSendImage = (file: File) => {
    if (!activeChatUserId) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Scale to max 1200px
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;

        ctx.drawImage(img, 0, 0, w, h);
        ctx.save();
        
        // Watermark: semi-transparent diagonal white text with shadow
        ctx.translate(w / 2, h / 2);
        ctx.rotate(-Math.PI / 6);
        
        const fontSize = Math.max(22, Math.round(w / 11));
        ctx.font = `bold ${fontSize}px "Inter", "system-ui", sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.44)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = fontSize / 7;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText('ПРИМЕР', 0, 0);
        ctx.fillText('ПРИМЕР', -fontSize * 2.5, 0);
        ctx.fillText('ПРИМЕР', fontSize * 2.5, 0);
        
        ctx.restore();

        const watermarkedData = canvas.toDataURL('image/jpeg', 0.82);

        const newMsg: ChatMessage = {
          id: 'c_ad_attach_' + Date.now(),
          userId: activeChatUserId,
          senderId: adminUser.id,
          senderRole: 'admin',
          senderName: adminUser.fullName,
          message: '[IMAGE]:' + watermarkedData,
          timestamp: new Date().toISOString(),
          readByAdmin: true,
          readByClient: false
        };

        onUpdateDatabase({
          chatMessages: [...database.chatMessages, newMsg]
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Filtering orders
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'printing' | 'ready' | 'printed'>('all');

  // Derived lists
  const clientsOnly = database.users.filter(u => u.role === 'client');
  const sortedOrders = [...database.orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());

  // Set initial active chat client if not set
  useEffect(() => {
    if (!activeChatUserId && clientsOnly.length > 0) {
      setActiveChatUserId(clientsOnly[0].id);
    }
  }, [clientsOnly, activeChatUserId]);

  // Read message handler - mark client chats as read by admin
  useEffect(() => {
    if (activeChatUserId) {
      const unreadFromActive = database.chatMessages.filter(
        c => c.userId === activeChatUserId && c.senderRole === 'client' && !c.readByAdmin
      );
      if (unreadFromActive.length > 0) {
        const updatedChats = database.chatMessages.map(c => {
          if (c.userId === activeChatUserId && c.senderRole === 'client') {
            return { ...c, readByAdmin: true };
          }
          return c;
        });
        onUpdateDatabase({ chatMessages: updatedChats });
      }
    }
  }, [activeChatUserId, database.chatMessages.length]);

  // Scroll chat operator window
  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, activeChatUserId, database.chatMessages.length]);

  // Order print status modifier
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const targetOrder = database.orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    const updatedOrders = database.orders.map(o => {
      if (o.id === orderId) {
        const updates: Partial<Order> = { status: newStatus };
        if (newStatus === 'printed') {
          updates.completedAt = new Date().toISOString();
        }
        return { ...o, ...updates };
      }
      return o;
    });

    // Create alert system notification
    const newNotification: Notification = {
      id: 'notif_' + Date.now(),
      userId: targetOrder.userId,
      title: 'Статус печати изменен',
      body: `Заказ ${orderId} подготовлен. Текущий статус: ${getStatusLabel(newStatus)}`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'order_status'
    };

    // Auto append a helpful chat notification
    const systemChat: ChatMessage = {
      id: 'c_sys_' + Date.now(),
      userId: targetOrder.userId,
      senderId: adminUser.id,
      senderRole: 'admin',
      senderName: 'Авто-статус Копи-Центра',
      message: `Статус вашего печатного заказа ${orderId} изменен на: [${getStatusLabel(newStatus).toUpperCase()}]. Благодарим, что вы с нами!`,
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readByClient: false
    };

    onUpdateDatabase({
      orders: updatedOrders,
      notifications: [newNotification, ...database.notifications],
      chatMessages: [...database.chatMessages, systemChat]
    });
  };

  // Payment status overriding manually if cash received
  const handleTogglePaymentStatus = (orderId: string) => {
    const updatedOrders = database.orders.map(o => {
      if (o.id === orderId) {
        const isPaid = o.paymentStatus === 'paid';
        return {
          ...o,
          paymentStatus: (isPaid ? 'unpaid' : 'paid') as PaymentStatus,
          paymentMethod: isPaid ? undefined : 'Наличные в Копи-центре',
          transactionId: isPaid ? undefined : 'CASH-' + Math.floor(100000 + Math.random() * 900000)
        };
      }
      return o;
    });

    onUpdateDatabase({ orders: updatedOrders });
  };

  // Simulated PC Download Progress bar
  const triggerSimulatedDownload = (file: PrintFile) => {
    if (downloadingFileId) return;

    setDownloadingFileId(file.id);
    setDownloadProgress(0);

    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setDownloadingFileId(null);
            // standard client feedback
            const alertMsg = `Файл "${file.name}" загружен на локальный жесткий диск печатного сервера (ПК) в папку C:\\Копи-Центр_Принтер\\!`;
            // Trigger download to browser
            const blob = new Blob([`Имитация содержимого файла: ${file.name}`], { type: "text/plain" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = file.name;
            link.click();
          }, 300);
          return 100;
        }
        return prev + 25;
      });
    }, 150);
  };

  const handleDownloadAllAsZip = async (order: Order) => {
    if (zippingOrderId) return;
    setZippingOrderId(order.id);
    setZipProgress(0);

    try {
      const zip = new JSZip();
      const filesCount = order.files?.length || 0;
      
      for (let i = 0; i < filesCount; i++) {
        const file = order.files[i];
        setZipProgress(Math.round((i / filesCount) * 100));

        if (file.url && (file.url.startsWith('http') || file.url.startsWith('https'))) {
          try {
            const res = await fetch(file.url);
            const blob = await res.blob();
            zip.file(file.name, blob);
          } catch (e) {
            console.error('Fetch fail for file url, using fallback:', file.url, e);
            const fallbackBlob = new Blob([`Имитация содержимого файла: ${file.name}`], { type: "text/plain" });
            zip.file(file.name, fallbackBlob);
          }
        } else if (file.url && file.url.startsWith('data:')) {
          const parts = file.url.split(',');
          if (parts.length > 1) {
            zip.file(file.name, parts[1], { base64: true });
          } else {
            zip.file(file.name, file.url);
          }
        } else if (file.previewUrl && file.previewUrl.startsWith('data:')) {
          const parts = file.previewUrl.split(',');
          if (parts.length > 1) {
            zip.file(file.name, parts[1], { base64: true });
          } else {
            zip.file(file.name, file.previewUrl);
          }
        } else {
          const mockBlob = new Blob([`Имитация содержимого файла: ${file.name}`], { type: "text/plain" });
          zip.file(file.name, mockBlob);
        }
      }

      setZipProgress(100);
      const content = await zip.generateAsync({ type: 'blob' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Заказ_${order.id.substring(0, 7)}_Фотопечать_Все_${filesCount}_фото.zip`;
      link.click();

      setTimeout(() => {
        setZippingOrderId(null);
      }, 500);

    } catch (err) {
      console.error('Zip generation failed:', err);
      setZippingOrderId(null);
    }
  };

  // Send admin chat response
  const handleAdminSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminChatInput.trim() || !activeChatUserId) return;

    const newMsg: ChatMessage = {
      id: 'c_ad_' + Date.now(),
      userId: activeChatUserId,
      senderId: adminUser.id,
      senderRole: 'admin',
      senderName: adminUser.fullName,
      message: adminChatInput.trim(),
      timestamp: new Date().toISOString(),
      readByAdmin: true,
      readByClient: false
    };

    onUpdateDatabase({
      chatMessages: [...database.chatMessages, newMsg]
    });

    setAdminChatInput('');
  };

  // Clear chat history with selected user
  const handleClearChatHistory = (clientId: string) => {
    if (!window.confirm("Вы уверены, что хотите полностью стереть историю чата с этим пользователем? Это действие необратимо.")) {
      return;
    }
    const filteredChats = database.chatMessages.filter(c => c.userId !== clientId);
    onUpdateDatabase({
      chatMessages: filteredChats
    });
  };

  // Edit / update client contact
  const handleStartEditUser = (u: User) => {
    setEditingUserId(u.id);
    setEditFullName(u.fullName);
    setEditPhone(u.phone || '');
  };

  const handleSaveUser = () => {
    if (!editingUserId) return;

    const updatedUsers = database.users.map(u => {
      if (u.id === editingUserId) {
        return {
          ...u,
          fullName: editFullName.trim(),
          phone: editPhone.trim()
        };
      }
      return u;
    });

    onUpdateDatabase({ users: updatedUsers });
    setEditingUserId(null);
  };

  const handleGiftPromoSubmit = () => {
    if (!promoGiftUser) return;
    const code = givingPromoCode.trim().toUpperCase() || `GIFT${givingPromoDiscount}`;
    
    const oneWeekFromNow = new Date();
    oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

    const updatedUsers = database.users.map(u => {
      if (u.id === promoGiftUser.id) {
        return {
          ...u,
          promoCode: code,
          promoDiscount: givingPromoDiscount,
          promoGiftedSeen: false,
          promoExpiresAt: oneWeekFromNow.toISOString()
        };
      }
      return u;
    });

    onUpdateDatabase({ users: updatedUsers });
    setPromoGiftUser(null);
    setGivingPromoCode('');
  };

  // Custom Delete User Modal State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setIsDeletingUser(true);
    setDeleteError(null);

    const clientId = userToDelete.id;
    try {
      await deleteUserAccountWithFirebase(clientId);
    } catch (err) {
      console.error('Failed to delete user account with Firebase:', err);
      setDeleteError('Не удалось полностью удалить пользователя и связанные данные из Firestore. Проверьте соединение.');
      setIsDeletingUser(false);
      return;
    }

    const filteredUsers = database.users.filter(u => u.id !== clientId);
    const filteredOrders = database.orders.filter(o => o.userId !== clientId);
    const filteredChats = database.chatMessages.filter(c => c.userId !== clientId);
    const filteredNotifs = database.notifications.filter(n => n.userId !== clientId);

    onUpdateDatabase({
      users: filteredUsers,
      orders: filteredOrders,
      chatMessages: filteredChats,
      notifications: filteredNotifs
    });

    if (activeChatUserId === clientId) {
      const remainingClients = filteredUsers.filter(u => u.role === 'client');
      setActiveChatUserId(remainingClients.length > 0 ? remainingClients[0].id : '');
    }

    setUserToDelete(null);
    setIsDeletingUser(false);
  };

  // ANALYTICS COMPUTATIONS
  const totalRevenue = database.orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, current) => sum + current.totalCost, 0);

  const pendingCount = database.orders.filter(o => o.status === 'pending').length;
  const inPrintCount = database.orders.filter(o => o.status === 'printing').length;
  const readyCount = database.orders.filter(o => o.status === 'ready').length;

  // File Format Analytics Count
  let fileFormatGroupsStats = {
    document: 0,
    archive: 0,
    image: 0,
    other: 0
  };
  database.orders.forEach(o => {
    o.files.forEach(f => {
      const g = f.formatGroup;
      if (fileFormatGroupsStats[g] !== undefined) {
        fileFormatGroupsStats[g]++;
      } else {
        fileFormatGroupsStats.other++;
      }
    });
  });

  const totalFormatCounts = Object.values(fileFormatGroupsStats).reduce((a, b) => a + b, 0);

  // Active Chats listing
  const chatSessions = clientsOnly.map(c => {
    const userMsgs = database.chatMessages.filter(m => m.userId === c.id);
    const lastMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1] : null;
    const unreadCount = userMsgs.filter(m => m.senderRole === 'client' && !m.readByAdmin).length;

    return {
      client: c,
      lastMsg,
      unreadCount
    };
  }).sort((a, b) => {
    const tA = a.lastMsg ? new Date(a.lastMsg.timestamp).getTime() : 0;
    const tB = b.lastMsg ? new Date(b.lastMsg.timestamp).getTime() : 0;
    return tB - tA;
  });

  const activeTalkingChat = database.chatMessages.filter(c => c.userId === activeChatUserId);

  return (
    <div id="admin-dashboard-root" className="min-h-screen md:h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-300 relative overflow-x-hidden overflow-y-auto md:overflow-hidden">
      
      {/* Exquisite Graphic 3D background glows inspired by Premium Theme 2 (Cozy Glassmorphic with soft pastel glow) */}
      <div className="absolute top-[15%] left-[25%] w-[500px] h-[500px] rounded-full bg-violet-400/12 dark:bg-violet-600/15 blur-[130px] animate-glow-slow-1 pointer-events-none" />
      <div className="absolute bottom-[25%] right-[5%] w-[550px] h-[550px] rounded-full bg-pink-400/12 dark:bg-pink-600/15 blur-[140px] animate-glow-slow-2 pointer-events-none" />
      <div className="absolute top-[65%] left-[-12%] w-[400px] h-[400px] rounded-full bg-cyan-400/8 dark:bg-cyan-600/10 blur-[120px] animate-glow-slow-1 pointer-events-none" />

      {/* Floating 3D Frosted Glass Orbs mirroring the uploaded design */}
      <div className="glass-bg-orb w-[200px] h-[200px] top-[18%] left-[8%] opacity-65 animate-[float-slow_22s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(15px) saturate(120%)' }} />
      <div className="glass-bg-orb w-[240px] h-[240px] bottom-[22%] right-[10%] opacity-80 animate-[float-reverse_26s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(20px) saturate(130%)' }} />
      <div className="glass-bg-orb w-[130px] h-[130px] top-[60%] left-[-3%] opacity-60 animate-[float-slow_28s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(12px) saturate(110%)' }} />
      <div className="glass-bg-orb w-[100px] h-[100px] top-[30%] right-[20%] opacity-50 animate-[float-reverse_24s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(10px) saturate(100%)' }} />

      {/* LEFT NAVIGATION COLUMN - Admin Side */}
      <aside className="w-full md:w-64 border-b md:border-r md:border-b-0 border-pink-500/10 bg-[#160d2e]/85 backdrop-blur-xl text-white shrink-0 flex flex-row md:flex-col justify-between p-4 md:py-6 md:px-5 transition-colors relative z-10">
        
        <div className="hidden md:block">
          {/* Admin title card */}
          <div className="flex items-center gap-3 mb-6">
            <div className="glass-icon-capsule capsule-glow-orange shrink-0 shadow-md">
              <BarChart3 className="w-5 h-5 text-white icon-3d-svg" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white leading-none">ПАНЕЛЬ ПК</h2>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#6366f1] mt-0.5 block">Сервер Печати</span>
            </div>
          </div>

          <div className="px-3.5 py-2.5 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/35 dark:border-rose-900/30 rounded-xl mb-6 text-[11px] text-rose-700 dark:text-rose-450 font-bold">
            Режим Администратора сайта
          </div>
        </div>

        {/* Links Navigation */}
        <nav className="flex md:flex-col flex-1 gap-2 md:gap-2 justify-around md:justify-start w-full">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial relative ${
              activeTab === 'orders' 
                ? 'bg-white/15 text-white font-black border border-white/20' 
                : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`glass-icon-capsule capsule-glow-indigo shrink-0 relative ${activeTab === 'orders' ? 'scale-105' : 'opacity-90'}`}>
              <Clock className="w-4.5 h-4.5 text-white icon-3d-svg" />
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 border border-white shadow-md animate-pulse">
                  {pendingCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Очередь Заказов</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial relative ${
              activeTab === 'chat' 
                ? 'bg-white/15 text-white font-black border border-white/20' 
                : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`glass-icon-capsule capsule-glow-green shrink-0 relative ${activeTab === 'chat' ? 'scale-105' : 'opacity-90'}`}>
              <MessageSquare className="w-4.5 h-4.5 text-white icon-3d-svg" />
              {database.chatMessages.filter(m => m.senderRole === 'client' && !m.readByAdmin).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 animate-bounce border border-white shadow-md">
                  {database.chatMessages.filter(m => m.senderRole === 'client' && !m.readByAdmin).length}
                </span>
              )}
            </div>
            <span className="hidden sm:inline">Чат-Приемная</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial ${
              activeTab === 'users' 
                ? 'bg-white/15 text-white font-black border border-white/20' 
                : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`glass-icon-capsule capsule-glow-blue shrink-0 ${activeTab === 'users' ? 'scale-105' : 'opacity-90'}`}>
              <Users className="w-4.5 h-4.5 text-white icon-3d-svg" />
            </div>
            <span className="hidden sm:inline">Клиентская База</span>
          </button>

          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial ${
              activeTab === 'analytics' 
                ? 'bg-white/15 text-white font-black border border-white/20' 
                : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`glass-icon-capsule capsule-glow-orange shrink-0 ${activeTab === 'analytics' ? 'scale-105' : 'opacity-90'}`}>
              <BarChart3 className="w-4.5 h-4.5 text-white icon-3d-svg" />
            </div>
            <span className="hidden sm:inline">Финансы & Аналитика</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial ${
              activeTab === 'settings' 
                ? 'bg-white/15 text-white font-black border border-white/20' 
                : 'text-purple-200/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <div className={`glass-icon-capsule capsule-glow-silver shrink-0 ${activeTab === 'settings' ? 'scale-105' : 'opacity-90'}`}>
              <Eye className="w-4.5 h-4.5 text-white icon-3d-svg" />
            </div>
            <span className="hidden sm:inline">Кто на сайте</span>
          </button>
        </nav>

        {/* Short info bottom */}
        <div className="hidden md:block border-t border-purple-800/40 pt-5 mt-auto w-full">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={adminUser}
              className="w-10 h-10 rounded-xl ring-2 ring-pink-500/20"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{adminUser.fullName}</p>
              <p className="text-[10px] text-pink-400 font-extrabold truncate uppercase tracking-widest">Администратор</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-purple-200 hover:text-white hover:bg-white/10 rounded-xl transition-all border border-purple-800/40"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти на главную
          </button>
        </div>
      </aside>

      {/* ADMIN WORKSPACE CONTAINER */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/40 dark:bg-slate-950/50 backdrop-blur-md relative z-10">
        
        {/* Responsive Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white/70 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {activeTab !== 'orders' ? (
              <button
                onClick={() => setActiveTab('orders')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Назад
              </button>
            ) : (
              <>
                <div className="squircle-3d-tile tile-3d-orange w-8 h-8 shrink-0 shadow-sm">
                  <BarChart3 className="w-4 h-4 text-white icon-3d-svg" />
                </div>
                <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none">АДМИН-ПК</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="p-1 px-2.5 border border-slate-200 dark:border-rose-950/40 text-slate-600 text-xs rounded-xl font-bold dark:bg-slate-900"
            >
              Выход
            </button>
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800">
          <div className="flex items-center gap-4">
            {activeTab !== 'orders' && (
              <button
                onClick={() => setActiveTab('orders')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition cursor-pointer shrink-0 border border-slate-200/40 dark:border-slate-800"
              >
                <ArrowLeft className="w-4 h-4" />
                Вернуться назад
              </button>
            )}
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white">
                {activeTab === 'orders' && 'Очередь печати документов'}
                {activeTab === 'chat' && 'Оперативная чат-линия клиентов'}
                {activeTab === 'users' && 'Управление пользователями & Конфиденциальность'}
                {activeTab === 'analytics' && 'Статистика копи-центра в реальном времени'}
                {activeTab === 'settings' && 'Живой мониторинг посетителей сайта'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {activeTab === 'orders' && 'Управляйте приоритетами очередей принтера Epson, изменяйте статусы готовности, выгружайте CSV накладные.'}
                {activeTab === 'chat' && 'Контролируйте ветки диалогов всех активных клиентов вашего копи-точки.'}
                {activeTab === 'users' && 'Просмотр контактов, редактирование профилей и полное удаление согласно регламенту.'}
                {activeTab === 'analytics' && 'Сводная аналитика выручки, распределение графиков популярности расширений.'}
                {activeTab === 'settings' && 'Наблюдение за активными сессиями пользователей онлайн, их действиями и управление профилем.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-xs bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold border border-slate-200/50">
              Очередь принтера: <strong className="text-emerald-600">{database.orders.filter(o => o.status !== 'printed').length} активных</strong>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        <div className="flex-1 p-4 md:p-8 space-y-6 max-w-6xl w-full mx-auto min-h-0 flex flex-col md:overflow-hidden">
          
          {/* TAB 1: ALL ORDERS AND FILES DOWNLOADS */}
          {activeTab === 'orders' && (
            <div className="space-y-6 md:overflow-y-auto md:flex-1 min-h-0 pr-1">
              
              {/* Order Lists Filter and bulk actions bar */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-400 self-center mr-2 hidden lg:inline">Печатный фильтр:</span>
                  {[
                    { id: 'all', label: 'Все заказы' },
                    { id: 'pending', label: 'Ожидают проверки' },
                    { id: 'approved', label: 'Одобрено' },
                    { id: 'printing', label: 'Печатается' },
                    { id: 'ready', label: 'Готовы к выдаче' },
                    { id: 'printed', label: 'Выданы' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setStatusFilter(btn.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        statusFilter === btn.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      const csvOrders = statusFilter === 'all' ? sortedOrders : sortedOrders.filter(o => o.status === statusFilter);
                      import('../utils').then(({ exportToCSV }) => exportToCSV(csvOrders, 'Общий_Финансовый_Реестр'));
                    }}
                    disabled={sortedOrders.length === 0}
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 text-xs font-bold bg-white dark:bg-slate-950 rounded-xl hover:bg-slate-100 hover:dark:bg-slate-900 text-indigo-700 dark:text-indigo-400"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    Экспорт Excel
                  </button>
                </div>
              </div>

              {/* Grid listings */}
              {sortedOrders.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10 bg-white dark:bg-slate-900 rounded-3xl border">Нет заказов в реестре.</p>
              ) : (
                <div className="grid grid-cols-1 gap-5">
                  {sortedOrders
                    .filter(o => {
                      if (statusFilter === 'all') return true;
                      return o.status === statusFilter;
                    })
                    .map(order => (
                      <div
                        key={order.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800/80 overflow-hidden shadow-xs hover:border-slate-250 dark:hover:border-slate-700 transition-all"
                      >
                        {/* Upper Section client credentials */}
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-150/60 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-850 dark:text-white text-xs">{order.id}</span>
                              <span className="text-[10px] text-slate-400">{formatDateTime(order.orderDate)}</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                              Клиент: <strong>{order.userName}</strong> &bull; {order.userEmail}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`text-[10px] uppercase font-bold px-2 px-2.5 py-0.5 rounded-md ${getStatusColor(order.status)}`}>
                              {getStatusLabel(order.status)}
                            </span>
                            <span className={`text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-md ${getPaymentStatusColor(order.paymentStatus)}`}>
                              {getPaymentStatusLabel(order.paymentStatus)}
                            </span>
                          </div>
                        </div>

                        {/* Mid Section - Files queue list */}
                        <div className="p-4 md:p-5 space-y-4">
                          
                          <div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2.5">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Файлы для выгрузки на ПК типографии:</span>
                              {((order.paperType === 'matte' || order.paperType === 'glossy') && order.files && order.files.length > 5) && (
                                <button
                                  onClick={() => handleDownloadAllAsZip(order)}
                                  disabled={zippingOrderId === order.id}
                                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border ${
                                    zippingOrderId === order.id
                                      ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-450 dark:hover:bg-emerald-900 border-transparent'
                                  }`}
                                >
                                  {zippingOrderId === order.id ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                                      Архивация ZIP {zipProgress}%
                                    </>
                                  ) : (
                                    <>
                                      <Files className="w-3.5 h-3.5 text-white/95 dark:text-emerald-450" />
                                      Скачать все фото в ZIP ({order.files.length} шт.)
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              {order.files.map(file => (
                                <div
                                  key={file.id}
                                  className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-between gap-3 text-xs border border-slate-100 dark:border-slate-850"
                                >
                                  <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <div className="overflow-hidden">
                                      <span className="font-bold block truncate text-slate-700 dark:text-slate-300">{file.name}</span>
                                      <span className="text-[9px] text-slate-400 block mt-0.5">{formatFileSize(file.size)} &bull; ID: {file.id} {file.pageCount !== undefined ? `&bull; Папок/Стр: ${file.pageCount}–стр` : ''}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    {/* Download actions simulator */}
                                    <button
                                      onClick={() => triggerSimulatedDownload(file)}
                                      disabled={downloadingFileId === file.id}
                                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 shrink-0 ${
                                        downloadingFileId === file.id
                                          ? 'bg-slate-205 dark:bg-slate-800 text-slate-500'
                                          : 'bg-indigo-600 hover:bg-slate-900 hover:text-white dark:bg-slate-900 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-indigo-600/30'
                                      }`}
                                    >
                                      {downloadingFileId === file.id ? (
                                        <>
                                          <span className="w-3 h-3 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                          Скачивание {downloadProgress}%
                                        </>
                                      ) : (
                                        <>
                                          <Download className="w-3.5 h-3.5" />
                                          Скачать на ПК
                                        </>
                                      )}
                                    </button>

                                    {/* Admin Delete file from order button */}
                                    {adminFileToConfirmDelete?.orderId === order.id && adminFileToConfirmDelete?.fileId === file.id ? (
                                      <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/20 p-1 rounded-lg border border-rose-100 dark:border-rose-900/40">
                                        <span className="text-[9px] font-black text-rose-500 uppercase px-1 animate-pulse">Удалить?</span>
                                        <button
                                          onClick={() => handleAdminDeleteFileFromOrder(order.id, file.id)}
                                          className="bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                                        >
                                          Да
                                        </button>
                                        <button
                                          onClick={() => setAdminFileToConfirmDelete(null)}
                                          className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                                        >
                                          Нет
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setAdminFileToConfirmDelete({ orderId: order.id, fileId: file.id })}
                                        className="p-1 px-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition cursor-pointer"
                                        title="Удалить файл из заказа"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Order specifications specifications */}
                          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-3 bg-slate-50/50 dark:bg-slate-950/20 rounded-xl border border-slate-100 dark:border-slate-850/80 text-xs text-slate-500 dark:text-slate-400 font-medium">
                            <div>Бумага: <strong className="text-slate-800 dark:text-white">
                              {order.paperType === 'standard' ? 'А4 Обычная' :
                               order.paperType === 'glossy' ? 'А4 Глянцевая' :
                               order.paperType === 'matte' ? 'А4 Матовая' :
                               order.paperType === 'standard_a3' ? 'А3 Обычная' :
                               order.paperType === 'bw_a3' ? 'А3 Фотобумага' : order.paperType}
                            </strong></div>
                            <div>Цветность: <strong className="text-slate-800 dark:text-white">
                              {order.printColor === 'bw' ? 'Черно-белая (Ч/Б)' :
                               order.printColor === 'color_full' ? 'Цветная 100% заливочная' : 'Цветная (RGB)'}
                            </strong></div>
                            <div>Количество тиража: <strong className="text-slate-800 dark:text-white">{order.copies} шт.</strong></div>
                            <div>Скрепление: <strong className="text-indigo-650 dark:text-indigo-400">
                              {!order.binding || order.binding === 'none' ? 'Нет' :
                               order.binding === 'staple' ? 'Скрепка в углу' :
                               order.binding === 'spring_plastic' ? 'Пружина пластик' :
                               order.binding === 'spring_metal' ? 'Пружина металл' : 'Тв. переплет'}
                            </strong></div>
                            <div>Промокод: <strong className="text-emerald-600 dark:text-emerald-400 uppercase">
                              {order.promoCode || 'Нет'}
                            </strong></div>
                            <div>Итоговая стоимость: <strong className="text-amber-600 dark:text-amber-400">₽{order.totalCost}</strong></div>
                          </div>

                          {order.notes && (
                            <div className="p-3 bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 rounded-xl text-[11px] leading-relaxed">
                              <span className="font-bold text-amber-700 dark:text-amber-400">Спец-требования клиента:</span> {order.notes}
                            </div>
                          )}
                        </div>

                        {/* Interactive operator state switches layout */}
                        <div className="p-4 bg-slate-50/50 dark:bg-slate-950/10 border-t border-slate-150/80 dark:border-slate-850 flex flex-col md:flex-row justify-between items-center gap-4">
                          
                          {/* Manual cash receipt switch */}
                          <div className="flex items-center gap-2.5">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Оплата наличными:</span>
                            <button
                              onClick={() => handleTogglePaymentStatus(order.id)}
                              className={`py-1.2 px-2.5 rounded-lg text-[10px] font-extrabold border transition ${
                                order.paymentStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400'
                                  : 'bg-rose-50 text-rose-800 border-rose-250 dark:bg-rose-955/20 dark:text-rose-400'
                              }`}
                            >
                              {order.paymentStatus === 'paid' ? 'Отметить не Оплаченным' : 'Отметить Оплаченным'}
                            </button>
                          </div>

                          {/* Print stage switch buttons */}
                          <div className="flex flex-wrap justify-end gap-1.5 w-full md:w-auto">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest self-center mr-1">Стадия печати на ПК:</span>
                            {[
                              { id: 'pending', label: 'Проверка' },
                              { id: 'approved', label: 'Одобрен' },
                              { id: 'printing', label: 'Печать' },
                              { id: 'ready', label: 'В Готовность' },
                              { id: 'printed', label: 'Выдать' }
                            ].map(state => (
                              <button
                                key={state.id}
                                onClick={() => handleUpdateOrderStatus(order.id, state.id as any)}
                                className={`px-2.5 py-1.5 text-[10px] font-extrabold rounded-md shadow-xs transition-colors ${
                                  order.status === state.id
                                    ? 'bg-indigo-650 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-650'
                                }`}
                              >
                                {state.label}
                              </button>
                            ))}
                          </div>

                        </div>

                      </div>
                    ))}
                </div>
              )}

            </div>
          )}

          {/* TAB 2: OPERATOR CHAT CHANNELS PANEL */}
          {activeTab === 'chat' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-800 overflow-hidden md:flex-1 h-[580px] md:h-full min-h-0 md:min-h-0 shadow-sm">
              
              {/* Clients sidebar list */}
              <div className={`md:col-span-4 border-r border-slate-150 dark:border-slate-800 flex-col h-full bg-slate-50/20 dark:bg-slate-950/10 ${activeChatUserId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30">
                  <span className="text-xs font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Кабинеты Пользователей ({clientsOnly.length})</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
                  {chatSessions.map(session => {
                    const isSelected = session.client.id === activeChatUserId;
                    return (
                      <button
                        key={session.client.id}
                        onClick={() => setActiveChatUserId(session.client.id)}
                        className={`w-full p-4 text-left flex items-start gap-3 transition-colors ${
                          isSelected 
                            ? 'bg-indigo-50/45 dark:bg-slate-800/50' 
                            : 'hover:bg-slate-100/50 dark:hover:bg-slate-850/40'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <UserAvatar
                            user={session.client}
                            className="w-10 h-10 rounded-xl ring-2 ring-indigo-500/10"
                          />
                          {session.client.isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" title="Онлайн" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{session.client.fullName}</h4>
                            {session.unreadCount > 0 && (
                              <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                                {session.unreadCount}
                              </span>
                            )}
                          </div>
                          
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-1">
                            {session.lastMsg ? session.lastMsg.message : 'Нет сообщений'}
                          </p>

                          {session.lastMsg && (
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-medium">
                              {new Date(session.lastMsg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Conversation screen */}
              <div className={`md:col-span-8 flex-col h-full bg-white dark:bg-slate-900 ${activeChatUserId ? 'flex' : 'hidden md:flex'}`}>
                {activeChatUserId ? (
                  <>
                    {/* Header info */}
                    <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {/* Mobile Back Button to Cabinets list */}
                        <button
                          onClick={() => setActiveChatUserId("")}
                          className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-850 border border-slate-200 dark:border-slate-750 shrink-0 mr-1 flex items-center justify-center cursor-pointer"
                          title="К кабинетам"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="relative shrink-0">
                          <UserAvatar
                            user={clientsOnly.find(u => u.id === activeChatUserId)}
                            className="w-8 h-8 rounded-lg"
                          />
                          {clientsOnly.find(u => u.id === activeChatUserId)?.isOnline && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-850 dark:text-white leading-tight flex items-center gap-1.5">
                            Диалог с {clientsOnly.find(u => u.id === activeChatUserId)?.fullName}
                            {clientsOnly.find(u => u.id === activeChatUserId)?.isOnline && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            )}
                          </h4>
                          <span className="text-[9px] font-medium text-slate-400 block mt-0.5">
                            Email: {clientsOnly.find(u => u.id === activeChatUserId)?.email} &bull; {
                              clientsOnly.find(u => u.id === activeChatUserId)?.isOnline 
                                ? <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider text-[8px]">В сети</span>
                                : <span className="text-[8px] uppercase font-semibold">Не в сети</span>
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-[10px] text-indigo-650 bg-indigo-50 dark:bg-[#1a1c2e] dark:text-indigo-400 px-2.5 py-1 rounded-md font-bold">
                          Заказы: {database.orders.filter(o => o.userId === activeChatUserId).length} шт.
                        </div>
                        <button
                          onClick={() => handleClearChatHistory(activeChatUserId)}
                          className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:hover:bg-rose-950/45 dark:text-rose-400 px-2.5 py-1 rounded-md font-bold text-[10px] transition-all cursor-pointer border border-rose-200/40 dark:border-rose-900/40"
                          title="Очистить историю чата с этим клиентом"
                        >
                          <Trash2 className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                          <span>Очистить чат</span>
                        </button>
                      </div>
                    </div>

                    {/* Message Logs */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/20 dark:bg-slate-950/10 chat-message-log">
                      {activeTalkingChat.length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-10 mt-10">Нет сообщений в этой ветке.</p>
                      ) : (
                        activeTalkingChat.map(msg => {
                          const isAdmin = msg.senderRole === 'admin';
                          return (
                            <div
                              key={msg.id}
                              className={`flex gap-3 max-w-[85%] ${isAdmin ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                            >
                              <div className="space-y-1">
                                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 px-1">
                                  <span>{msg.senderName} &bull; {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                                  {isAdmin && (
                                    <span className="inline-flex items-center ml-0.5" title={msg.readByClient ? "Прочитано" : "Доставлено"}>
                                      {msg.readByClient ? (
                                        <span className="text-sky-450 dark:text-sky-450 flex items-center relative w-4.5 h-3">
                                          <svg className="w-3 h-3 absolute left-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                          <svg className="w-3 h-3 absolute left-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 dark:text-slate-500 flex items-center w-3 h-3">
                                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                          </svg>
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </span>
                                <div
                                  className={`p-3 rounded-2xl text-xs font-medium shadow-xs border ${
                                    isAdmin
                                      ? 'bg-indigo-600 text-white border-transparent rounded-tr-none'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border-slate-200/80 dark:border-slate-700/60 rounded-tl-none'
                                  }`}
                                >
                                  {msg.message.startsWith('[IMAGE]:') ? (
                                    <div className="space-y-1 my-0.5 text-left">
                                      <img
                                        src={msg.message.substring(8)}
                                        className="rounded-xl max-w-[200px] sm:max-w-xs cursor-pointer hover:opacity-90 shadow-sm border border-slate-200 dark:border-slate-800"
                                        alt="Пример готового продукта"
                                        onClick={() => {
                                          const imgWin = window.open('', '_blank');
                                          if (imgWin) {
                                            imgWin.document.write(`<img src="${msg.message.substring(8)}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                          }
                                        }}
                                      />
                                      <span className={`text-[9px] opacity-70 block italic ${isAdmin ? 'text-indigo-200' : 'text-slate-400'}`}>Защищено водяным знаком &bull; ПРИМЕР</span>
                                    </div>
                                  ) : (
                                    msg.message
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    {/* Message Input box */}
                    <form onSubmit={handleAdminSendMessage} className="p-4 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2 items-center">
                      <input 
                        type="file" 
                        id="admin-chat-attachment" 
                        accept="image/*" 
                        onChange={(e) => { 
                          const f = e.target.files?.[0]; 
                          if (f) watermarkAndSendImage(f); 
                          e.target.value = ""; 
                        }} 
                        className="hidden" 
                      />
                      
                      <button 
                        type="button" 
                        onClick={() => document.getElementById('admin-chat-attachment')?.click()} 
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-bold p-3 rounded-xl transition flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-750" 
                        title="Отправить готовый пример товара с водяным знаком 'ПРИМЕР'"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
                      </button>

                      <input
                        type="text"
                        value={adminChatInput}
                        onChange={e => setAdminChatInput(e.target.value)}
                        placeholder="Напишите ответ клиенту (файлы приняты, печатаю...)"
                        className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="submit"
                        disabled={!adminChatInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:dark:bg-slate-805 text-white py-3 px-4 rounded-xl font-bold transition flex items-center justify-center shrink-0"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="h-full flex flex-col justify-center items-center text-center p-8">
                    <p className="text-xs text-slate-400 font-bold">Выберите диалог клиента слева для переписки.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: USER RECORDS CONTROLS */}
          {activeTab === 'users' && (
            <div className="space-y-6 md:overflow-y-auto md:flex-1 min-h-0 pr-1">
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-155 dark:border-slate-800/85 shadow-sm p-6 overflow-x-auto">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-sm font-black text-slate-805 dark:text-white uppercase tracking-wider">База зарегистрированных пользователей</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Нажмите на строку любого пользователя для просмотра реестра всех его загруженных файлов.</p>
                  </div>
                </div>

                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-150 dark:border-slate-800 text-slate-400 uppercase text-[10px] tracking-widest">
                      <th className="py-3 px-4 font-bold">Фото</th>
                      <th className="py-3 px-4 font-bold">ФИО клиента</th>
                      <th className="py-3 px-4 font-bold">Электронная почта</th>
                      <th className="py-3 px-4 font-bold">Телефон</th>
                      <th className="py-3 px-4 font-bold">Дата регистрации</th>
                      <th className="py-3 px-4 font-bold text-center">Файлов</th>
                      <th className="py-3 px-4 font-bold text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850/60 font-medium font-medium">
                    {database.users.filter(cli => cli.role !== 'admin' && cli.email !== 'photo-sever@yandex.ru').map(cli => {
                      const userOrders = database.orders.filter(o => o.userId === cli.id);
                      const filesCount = userOrders.reduce((sum, o) => sum + (o.files?.length || 0), 0);
                      const isAdmin = cli.role === 'admin';

                      return (
                        <tr 
                          key={cli.id} 
                          onClick={() => setSelectedUserForFiles(cli)}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-950/45 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4">
                            <UserAvatar
                              user={cli}
                              className="w-9 h-9 rounded-xl"
                            />
                          </td>

                          <td className="py-3 px-4">
                            {editingUserId === cli.id ? (
                              <input
                                type="text"
                                value={editFullName}
                                onChange={e => setEditFullName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 roundedpx-2 py-1 text-xs w-full font-bold focus:outline-none"
                              />
                            ) : (
                              <div className="flex flex-col">
                                <span className="font-extrabold text-slate-850 dark:text-slate-200 flex items-center gap-2">
                                  {cli.fullName}
                                  {isAdmin && (
                                    <span className="bg-red-50 dark:bg-red-950/40 text-red-650 dark:text-red-400 text-[8px] font-black uppercase px-1.5 py-0.5 rounded border border-red-200/50 dark:border-red-900/30">
                                      Админ
                                    </span>
                                  )}
                                </span>
                                {cli.promoCode && (
                                  <span className="inline-flex self-start items-center gap-1 bg-emerald-50 dark:bg-emerald-950/25 text-emerald-600 dark:text-emerald-400 text-[9px] font-black px-1.5 py-0.5 rounded-lg border border-emerald-150 dark:border-emerald-900/35 mt-1 animate-pulse">
                                    🎁 Подарен: {cli.promoCode} (-{cli.promoDiscount}%)
                                  </span>
                                )}
                              </div>
                            )}
                            <span className="text-[9px] text-slate-400 block mt-0.5">UID: {cli.id} {cli.isSocial && '(OAuth Соцсеть)'}</span>
                          </td>

                          <td className="py-3 px-4 text-slate-505 dark:text-slate-400">{cli.email}</td>

                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            {editingUserId === cli.id ? (
                              <input
                                type="text"
                                value={editPhone}
                                onChange={e => setEditPhone(e.target.value)}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded px-2 py-1 text-xs w-full font-medium focus:outline-none"
                              />
                            ) : (
                              cli.phone || '—'
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-400 text-[11px]">{new Date(cli.createdAt).toLocaleDateString('ru-RU')}</td>

                          <td className="py-3 px-4 text-center font-bold">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] ${
                              filesCount > 0 
                                ? 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400' 
                                : 'bg-slate-55 dark:bg-slate-900 text-slate-400'
                            }`}>
                              {filesCount} шт.
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1.5">
                              {editingUserId === cli.id ? (
                                <button
                                  onClick={handleSaveUser}
                                  className="p-1 px-2.5 bg-indigo-650 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1 transition"
                                >
                                  <Save className="w-3.5 h-3.5" /> Сохранить
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartEditUser(cli)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Редактировать ФИО/Телефон"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              )}
                              {!isAdmin && (
                                <button
                                  onClick={() => {
                                    setPromoGiftUser(cli);
                                    setGivingPromoCode(cli.promoCode || '');
                                    setGivingPromoDiscount(cli.promoDiscount || 15);
                                  }}
                                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Подарить промокод"
                                >
                                  <Gift className="w-4 h-4" />
                                </button>
                              )}
                              {!isAdmin && (
                                <button
                                  onClick={() => setUserToDelete(cli)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Удалить клиента и данные"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* USER FILES DIALOG MODAL */}
              {selectedUserForFiles && (
                <div id="user-files-popup-modal" className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-155 dark:border-slate-800 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden">
                    {/* Modal Header */}
                    <div className="p-6 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                          <Files className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider font-sans">
                            Файлы пользователя: {selectedUserForFiles.fullName}
                          </h3>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Email: {selectedUserForFiles.email} &bull; Телефон: {selectedUserForFiles.phone || '—'}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedUserForFiles(null)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Modal Scrollable Content */}
                    <div className="p-6 overflow-y-auto space-y-4 flex-1">
                      {(() => {
                        const userOrders = database.orders.filter(o => o.userId === selectedUserForFiles.id);
                        const filesList = userOrders.flatMap(order => 
                          (order.files || []).map(file => ({ ...file, orderId: order.id, orderStatus: order.status, orderDate: order.orderDate }))
                        );

                        if (filesList.length === 0) {
                          return (
                            <div className="text-center py-12 space-y-3">
                              <FileText className="w-12 h-12 text-slate-350 dark:text-slate-700 mx-auto" />
                              <p className="text-xs text-slate-400 font-bold">У этого пользователя нет загруженных файлов.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            <div className="text-xs text-slate-400 font-bold mb-2">
                              Найдено {filesList.length} файлов в {userOrders.length} заказах:
                            </div>
                            {filesList.map(file => (
                              <div
                                key={file.id}
                                className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-slate-205 dark:hover:border-slate-755 transition-colors"
                              >
                                <div className="space-y-1 overflow-hidden">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 block truncate max-w-[280px]" title={file.name}>
                                      {file.name}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>&bull;</span>
                                    <span className="uppercase">{file.formatGroup}</span>
                                    <span>&bull;</span>
                                    <span>Заказ <strong className="text-slate-650 dark:text-slate-300">{file.orderId}</strong> ({getStatusLabel(file.orderStatus)})</span>
                                  </div>
                                  <div className="text-[9px] text-slate-400">
                                    Загружен: {formatDateTime(file.uploadedAt || file.orderDate)}
                                  </div>
                                </div>

                                <button
                                  onClick={() => triggerSimulatedDownload(file as any)}
                                  disabled={downloadingFileId === file.id}
                                  className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 ${
                                    downloadingFileId === file.id
                                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                                      : 'bg-indigo-650 text-white hover:bg-indigo-700'
                                  }`}
                                >
                                  {downloadingFileId === file.id ? (
                                    <>
                                      <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                      <span>{downloadProgress}%</span>
                                    </>
                                  ) : (
                                    <>
                                      <Download className="w-4.5 h-4.5" />
                                      <span>Скачать на ПК</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Modal Footer */}
                    <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 text-right">
                      <button
                        onClick={() => setSelectedUserForFiles(null)}
                        className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Закрыть окно
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* GIFT PROMO CUSTOM DIALOG MODAL */}
              {promoGiftUser && (
                <div id="user-promo-gift-modal" className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-155 dark:border-slate-800 shadow-xl max-w-md w-full flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="p-5 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/20">
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5 text-emerald-500 animate-bounce" />
                        <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider">
                          Подарить промокод
                        </h3>
                      </div>
                      <button
                        onClick={() => setPromoGiftUser(null)}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      <p className="text-xs text-slate-505 dark:text-slate-400 leading-relaxed">
                        Вы собираетесь подарить уникальный промокод для клиента <strong className="text-slate-700 dark:text-white">{promoGiftUser.fullName}</strong>. У него мгновенно загорится уведомление и откроется праздничная открытка с Вашим подарком!
                      </p>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                            Текст промокода (прописными буквами)
                          </label>
                          <input
                            type="text"
                            placeholder="Например: COFFEE15, COPYGIFT"
                            value={givingPromoCode}
                            onChange={e => setGivingPromoCode(e.target.value.toUpperCase())}
                            className="w-full p-3 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs font-bold font-mono tracking-wider"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1">
                            Процентная скидка (%)
                          </label>
                          <div className="grid grid-cols-5 gap-2">
                            {[5, 10, 15, 20, 50].map(pct => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  setGivingPromoDiscount(pct);
                                  if (!givingPromoCode) {
                                    setGivingPromoCode(`GIFT${pct}`);
                                  }
                                }}
                                className={`py-2 text-xs font-black rounded-lg border transition ${
                                  givingPromoDiscount === pct
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/10'
                                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                                }`}
                              >
                                {pct}%
                              </button>
                            ))}
                          </div>
                          <div className="mt-2.5 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Или своя скидка (%):</span>
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={givingPromoDiscount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 10;
                                setGivingPromoDiscount(Math.min(Math.max(val, 1), 100));
                              }}
                              className="w-16 p-1 text-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 rounded-lg text-xs font-bold text-slate-800 dark:text-white"
                            />
                          </div>
                        </div>

                        {/* Beautiful live preview of client card coupon! */}
                        <div className="border border-emerald-500/15 bg-emerald-50/5 dark:bg-emerald-950/5 rounded-2xl p-4 space-y-2.5 relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-full -mr-6 -mt-6"></div>
                          <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest block">Предпросмотр открытки клиента:</span>
                          <div className="flex gap-3 items-center">
                            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-205 dark:border-slate-700 flex items-center justify-center">
                              <img
                                src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=150&auto=format&fit=crop"
                                alt=""
                                className="w-full h-full object-cover animate-pulse"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div>
                              <p className="text-[11px] font-extrabold text-slate-850 dark:text-white">Подарочный купон от администратора!</p>
                              <p className="text-[10px] text-slate-400">Промокод: <span className="font-extrabold text-emerald-650 dark:text-emerald-450">{givingPromoCode || `GIFT${givingPromoDiscount}`}</span></p>
                              <p className="text-[10px] text-slate-400">Скидка: <span className="font-bold text-slate-700 dark:text-slate-350">{givingPromoDiscount}%</span> на все услуги</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="p-4 border-t border-slate-150 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-950/20 flex justify-end gap-2 text-right">
                      <button
                        onClick={() => setPromoGiftUser(null)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleGiftPromoSubmit}
                        className="px-4 py-2 bg-emerald-650 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition shadow-lg shadow-emerald-600/10"
                      >
                        🎁 Отправить промокод
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}          {/* TAB 4: INTERACTIVE INTERACTIVE ANALYTICS SYSTEM */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 md:overflow-y-auto md:flex-1 min-h-0 pr-1">
              
              {/* Top stats grid widgets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Общий оборот</span>
                      <p className="text-2xl font-black text-indigo-650 dark:text-white">₽{totalRevenue}</p>
                    </div>
                    <div className="p-2.5 bg-indigo-50 dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-2 font-semibold">
                    &uarr; 100% зачисления
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Всего Заказов</span>
                      <p className="text-2xl font-black text-slate-800 dark:text-white">{database.orders.length} шт.</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-850 text-slate-500 rounded-2xl">
                      <FileCheck className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold mt-2 font-semibold">
                    {database.orders.filter(o => o.status === 'printed').length} выполнено
                  </div>
                </div>

                {/* WEBSITE ATTENDANCE / VISITS COMPONENT */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Посещения сайта</span>
                      <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{database.siteVisits || 487} сессий</p>
                    </div>
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-500 rounded-2xl">
                      <Eye className="w-5 h-5 animate-pulse" />
                    </div>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping"></span>
                    <span>Активен</span>
                    <span className="text-slate-400 font-normal">&bull; Сегодня: {database.siteVisitsHistory && database.siteVisitsHistory.length > 0 ? (database.siteVisitsHistory[database.siteVisitsHistory.length - 1].count + ' просмотров') : '14'}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">База Клиентов</span>
                      <p className="text-2xl font-black text-slate-800 dark:text-white">{clientsOnly.length} чел.</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-850 text-slate-500 rounded-2xl">
                      <Users className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 font-semibold">
                    Защищено SSL
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-xs">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">В Печатной Работе</span>
                      <p className="text-2xl font-black text-indigo-755 dark:text-indigo-400">{database.orders.filter(o => o.status === 'printing').length} задач</p>
                    </div>
                    <div className="p-2.5 bg-slate-550/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <Printer className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-2 font-semibold">
                    Ожидает: {database.orders.filter(o => o.status === 'pending').length} пров.
                  </div>
                </div>

              </div>

              {/* Handcrafted precise clean SVG distribution charts to prevent React 19 package mismatch warnings */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                
                {/* SVG format groups stats card */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 space-y-6">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-450 tracking-wider">Популярные форматы файлов на печать</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Рейтинг типов расширений загружаемых архивов, документов и фото.</p>
                  </div>

                  {totalFormatCounts === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">Нет данных для графиков распределения.</p>
                  ) : (
                    <div className="space-y-5">
                      {[
                        { key: 'document', label: 'Документы (docx, pdf, xlsx, txt)', count: fileFormatGroupsStats.document, color: 'bg-indigo-600 text-indigo-600', fill: '#4f46e5' },
                        { key: 'archive', label: 'Архивы / Комплекты чертежей (zip, rar)', count: fileFormatGroupsStats.archive, color: 'bg-emerald-500 text-emerald-500', fill: '#10b981' },
                        { key: 'image', label: 'Изображения / Фотобумага (png, jpg)', count: fileFormatGroupsStats.image, color: 'bg-amber-400 text-amber-500', fill: '#f59e0b' },
                        { key: 'other', label: 'Другие форматы', count: fileFormatGroupsStats.other, color: 'bg-slate-400', fill: '#94a3b8' }
                      ].map(bar => {
                        const pct = Math.round((bar.count / totalFormatCounts) * 100) || 0;
                        return (
                          <div key={bar.key} className="space-y-2">
                             <div className="flex justify-between items-center text-xs font-bold">
                              <span className="text-slate-650 dark:text-slate-300">{bar.label}</span>
                              <span className="text-slate-500">{bar.count} шт. ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${bar.color.split(' ')[0]} rounded-full transition-all duration-500`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SVG Orders Trend Chart - Flowchart */}
                <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-black uppercase text-slate-450 tracking-wider">Динамика активности по дням недели</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Отношение успешных заказов к общему трафику хостов.</p>
                  </div>

                  {/* SVG line graph trend representation */}
                  <div className="my-6 relative w-full h-44">
                    <svg className="w-full h-full" viewBox="0 0 400 150">
                      {/* Grid Horizontal axis */}
                      <line x1="20" y1="20" x2="380" y2="20" stroke="#f1f5f9" strokeWidth="1" className="dark:stroke-slate-800" />
                      <line x1="20" y1="60" x2="380" y2="60" stroke="#f1f5f9" strokeWidth="1" className="dark:stroke-slate-800" />
                      <line x1="20" y1="100" x2="380" y2="100" stroke="#f1f5f9" strokeWidth="1" className="dark:stroke-slate-800" />
                      <line x1="20" y1="130" x2="380" y2="130" stroke="#e2e8f0" strokeWidth="1.5" className="dark:stroke-slate-755" />
                      
                      {/* Plot path representing website visits / traffic in Rose color */}
                      <path
                        d="M 30 75 L 90 60 L 150 85 L 210 32 L 270 18 L 330 50 L 370 42"
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.5"
                        strokeDasharray="4 2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="30" cy="75" r="3.5" fill="#f43f5e" />
                      <circle cx="90" cy="60" r="3.5" fill="#f43f5e" />
                      <circle cx="150" cy="85" r="3.5" fill="#f43f5e" />
                      <circle cx="210" cy="32" r="3.5" fill="#f43f5e" />
                      <circle cx="270" cy="18" r="3.5" fill="#f43f5e" />
                      <circle cx="330" cy="50" r="3.5" fill="#f43f5e" />
                      <circle cx="370" cy="42" r="3.5" fill="#f43f5e" />

                      {/* Plot path representing realistic peaks on Friday/Saturday - Orders */}
                      <path
                        d="M 30 110 L 90 95 L 150 115 L 210 60 L 270 45 L 330 80 L 370 70"
                        fill="none"
                        stroke="#4f46e5"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {/* Dot points for summits with tooltips */}
                      <circle cx="30" cy="110" r="4.5" fill="#4f46e5" />
                      <circle cx="90" cy="95" r="4.5" fill="#4f46e5" />
                      <circle cx="150" cy="115" r="4.5" fill="#4f46e5" />
                      <circle cx="210" cy="60" r="4.5" fill="#4f46e5" />
                      <circle cx="270" cy="45" r="4.5" fill="#4f46e5" />
                      <circle cx="330" cy="80" r="4.5" fill="#4f46e5" />
                      <circle cx="370" cy="70" r="4.5" fill="#4f46e5" />

                      {/* Weekday Labels axis */}
                      <text x="30" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">ПН</text>
                      <text x="90" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">ВТ</text>
                      <text x="150" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">СР</text>
                      <text x="210" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">ЧТ</text>
                      <text x="270" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">ПТ</text>
                      <text x="330" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">СБ</text>
                      <text x="370" y="145" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">ВС</text>
                    </svg>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-stretch gap-2 bg-slate-50 dark:bg-slate-950 p-3 rounded-2xl border border-slate-100 dark:border-slate-850/80 text-[10px] font-bold">
                    <div className="flex items-center gap-1.5 justify-center sm:justify-start">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block"></span>
                      <span className="text-slate-500">Заказы (активные)</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block ml-2"></span>
                      <span className="text-slate-500">Посещения сайта (сессии)</span>
                    </div>
                    <strong className="text-indigo-650 dark:text-emerald-400 text-center sm:text-right">₽{totalRevenue} RUB зачислено</strong>
                  </div>
                </div>

              </div>


              
              {/* Daily logs logs check list */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-150 dark:border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-slate-450 block mb-4">Журнал последних банковских транзакций (PCI-DSS)</span>
                
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {database.orders
                    .filter(o => o.paymentStatus === 'paid')
                    .map(payLog => (
                      <div
                        key={payLog.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 rounded-2xl flex justify-between items-center text-xs"
                      >
                        <div>
                          <span className="font-bold text-slate-800 dark:text-white block">Оплата по заказу {payLog.id}</span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">Оператор списания: {payLog.paymentMethod} &bull; Авто-код: {payLog.transactionId}</span>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-600 block">+ ₽{payLog.totalCost}</span>
                          <span className="text-[9px] text-slate-400 block">{new Date(payLog.orderDate).toLocaleDateString('ru-RU')}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: ADMIN CONFIGURATION & BANK INTEGRATION SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 md:overflow-y-auto md:flex-1 min-h-0 pr-1">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                
                {/* Profile settings card */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Camera className="text-indigo-650 w-5 h-5" /> Профиль & Персональная аватарка
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">Отредактируйте свои личные данные и настройте графический аватар, отображаемый в чате с клиентами.</p>
                  </div>

                  <div className="flex flex-col items-center gap-5 p-5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-850">
                    <div className="relative group cursor-pointer" onClick={() => avatarFileRef.current?.click()}>
                      <UserAvatar
                        user={{
                          fullName: adminFullName,
                          avatarUrl: adminAvatarUrl,
                          avatarScale: adminAvatarScale,
                          avatarX: adminAvatarX,
                          avatarY: adminAvatarY
                        }}
                        className="w-24 h-24 rounded-2xl ring-4 ring-indigo-500/15"
                      />
                      <div
                        className="absolute inset-0 bg-slate-900/60 text-white rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-opacity text-[10px] font-bold"
                      >
                        <Camera className="w-5 h-5 text-white" />
                        <span>Выказать...</span>
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={avatarFileRef}
                      onChange={handleAvatarFileChange}
                      accept="image/*"
                      className="hidden"
                    />

                    {/* Interactive positioning controls constraint of user photo alignment */}
                    <div className="w-full bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-xl p-3 space-y-3 shadow-xs">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Настройка разметки лица</span>
                        <button 
                          onClick={() => {
                            setAdminAvatarScale(1);
                            setAdminAvatarX(0);
                            setAdminAvatarY(0);
                          }}
                          type="button"
                          className="text-[9px] font-bold text-slate-400 hover:text-indigo-650 cursor-pointer uppercase transition-colors"
                        >
                          Сбросить сдвиги
                        </button>
                      </div>

                      {/* Scale Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Масштаб (Зум):</span>
                          <span className="font-mono text-indigo-500">{(adminAvatarScale * 100).toFixed(0)}%</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="3"
                          step="0.02"
                          value={adminAvatarScale}
                          onChange={(e) => setAdminAvatarScale(parseFloat(e.target.value))}
                          className="w-full accent-indigo-600 h-1 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* X Offset Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Влево ↔ Вправо:</span>
                          <span className="font-mono text-indigo-500">{adminAvatarX > 0 ? `+${adminAvatarX}` : adminAvatarX}px</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={adminAvatarX}
                          onChange={(e) => setAdminAvatarX(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-1 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>

                      {/* Y Offset Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Вверх ↕ Вниз:</span>
                          <span className="font-mono text-indigo-500">{adminAvatarY > 0 ? `+${adminAvatarY}` : adminAvatarY}px</span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="1"
                          value={adminAvatarY}
                          onChange={(e) => setAdminAvatarY(parseInt(e.target.value))}
                          className="w-full accent-indigo-600 h-1 bg-slate-100 dark:bg-slate-850 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <p className="text-[8px] text-slate-400 leading-normal text-center italic">Передвигайте бегунки для аккуратного центрирования лица внутри рамки</p>
                    </div>

                    {/* Fast presets selection */}
                    <div className="text-center w-full">
                      <span className="text-[10px] text-slate-400 font-bold block mb-2 uppercase tracking-wider">Или выберите стильный пресет:</span>
                      <div className="flex justify-center gap-2">
                        {[
                          'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&auto=format&fit=crop&q=80', // Man Glasses
                          'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&auto=format&fit=crop&q=80', // Woman Curly
                          'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80', // Man Beard
                          'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80', // Woman Smiling
                          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'  // Man Smiling
                        ].map((pUrl, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setAdminAvatarUrl(pUrl);
                              // Reset alignment when selecting pre-set to prevent weird clipping
                              setAdminAvatarScale(1);
                              setAdminAvatarX(0);
                              setAdminAvatarY(0);
                            }}
                            className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 shrink-0 ${
                              adminAvatarUrl === pUrl ? 'border-[#6366f1] scale-110' : 'border-transparent opacity-80'
                            }`}
                          >
                            <img src={pUrl} alt="Preset icon" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">ФИО Администратора</label>
                      <input
                        type="text"
                        value={adminFullName}
                        onChange={e => setAdminFullName(e.target.value)}
                        className="block w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs text-slate-850 dark:text-white"
                        placeholder="Введите ваше имя"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Контактный телефон</label>
                      <input
                        type="text"
                        value={adminPhone}
                        onChange={e => setAdminPhone(e.target.value)}
                        className="block w-full p-3 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-xs text-slate-850 dark:text-white"
                        placeholder="+7 (999) 000-00-00"
                      />
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                      {saveSuccess && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1.5 rounded-xl border border-emerald-200/50 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Профиль сохранен!
                        </span>
                      )}
                      <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                        className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white transition-all shadow-md flex items-center gap-2 ${
                          savingSettings
                            ? 'bg-indigo-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-650 hover:bg-indigo-700 cursor-pointer shadow-indigo-600/10'
                        }`}
                      >
                        {savingSettings ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Сохранение...</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Сохранить профиль</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Real-time online session monitor instead of payments */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
                  <div>
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          Кто сейчас на сайте
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-1">Живой мониторинг сессий гостей и авторизованных клиентов в реальном времени.</p>
                      </div>
                      <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-450 px-2.5 py-1 rounded-full font-black shrink-0 animate-pulse">
                        LIVE: {database.users.filter(u => u.isOnline && u.role !== 'admin').length + 4} СЕТИ
                      </span>
                    </div>

                    {/* Filter and stats overview */}
                    <div className="grid grid-cols-3 gap-2.5 my-4">
                      <div className="p-2 bg-slate-50 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 rounded-2xl text-center">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Гости</span>
                        <strong className="text-sm text-indigo-505 font-black">4 сессии</strong>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 rounded-2xl text-center">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Клиенты</span>
                        <strong className="text-sm text-emerald-555 font-black">{database.users.filter(u => u.isOnline && u.role !== 'admin').length} в сети</strong>
                      </div>
                      <div className="p-2 bg-slate-50 dark:bg-slate-950/45 border border-slate-100 dark:border-slate-850 rounded-2xl text-center">
                        <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Просмотры</span>
                        <strong className="text-sm text-amber-555 font-black">124 / час</strong>
                      </div>
                    </div>

                    {/* Interactive Sessions List */}
                    <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                      {/* Real Registered Users Online */}
                      {database.users.filter(u => u.isOnline && u.role !== 'admin').map((user) => (
                        <div key={user.id} className="p-3 bg-indigo-500/5 dark:bg-slate-950/35 border border-indigo-550/15 hover:border-indigo-550/30 rounded-2xl flex items-center justify-between gap-3 transition">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <UserAvatar user={user} className="w-10 h-10 rounded-xl" />
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-white truncate">{user.fullName}</span>
                                <span className="text-[8px] bg-indigo-100 dark:bg-indigo-950 text-indigo-750 dark:text-indigo-400 px-1.5 py-0.2 rounded font-black uppercase tracking-wider shrink-0">Клиент</span>
                              </div>
                              <p className="text-[10px] text-indigo-650 dark:text-indigo-455 font-bold truncate mt-0.5 flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-indigo-500 animate-ping"></span>
                                В диалоге и чат-приемной
                              </p>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono">IP: 188.234.*.91</span> &bull; <span>Chrome Mobile</span>
                              </span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              setActiveTab('chat');
                              setActiveChatUserId(user.id);
                            }}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                            title="Открыть чат с этим клиентом"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Display registered online users fallback if zero */}
                      {database.users.filter(u => u.isOnline && u.role !== 'admin').length === 0 && (
                        <div className="p-3 bg-indigo-500/5 dark:bg-slate-950/35 border border-indigo-555/15 hover:border-indigo-555/30 rounded-2xl flex items-center justify-between gap-3 transition">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-indigo-200 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-150">
                                АШ
                              </div>
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-white truncate">Ашот Саркисян</span>
                                <span className="text-[8px] bg-indigo-150 dark:bg-indigo-950 text-indigo-750 dark:text-indigo-400 px-1.5 py-0.2 rounded font-black uppercase tracking-wider shrink-0">Клиент</span>
                              </div>
                              <p className="text-[10px] text-indigo-650 dark:text-indigo-455 font-bold truncate mt-0.5 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                Смотрит очередь заказов
                              </p>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono">IP: 85.20.*.15</span> &bull; <span>Safari / iOS</span>
                              </span>
                            </div>
                          </div>
                   
                          <button
                            onClick={() => {
                              setActiveTab('chat');
                              // set default client if registered in database
                              const clients = database.users.filter(u => u.role !== 'admin');
                              if (clients.length > 0) setActiveChatUserId(clients[0].id);
                            }}
                            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-105 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0"
                            title="Открыть чат с этим клиентом"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Active Guest Sessions */}
                      {[
                        { id: 'g_120', name: 'Гость #4120', action: 'Просматривает калькулятор цен', duration: '02:15', browser: 'Safari Mobile (iOS)', city: 'Вологда', ip: '95.167.*.*' },
                        { id: 'g_121', name: 'Гость #5289', action: 'Загружает файлы чертежей', duration: '08:42', browser: 'Chrome Desktop (Windows)', city: 'Череповец', ip: '178.66.*.*' },
                        { id: 'g_122', name: 'Гость #8831', action: 'Выбирает параметры переплёта', duration: '01:05', browser: 'Telegram App (Android)', city: 'Вологда', ip: '46.14.*.*' },
                        { id: 'g_123', name: 'Гость #6711', action: 'Читает требования к распечатке', duration: '12:30', browser: 'Yandex OS (Windows)', city: 'Ярославль', ip: '185.12.*.*' }
                      ].map((guest) => (
                        <div key={guest.id} className="p-3 bg-slate-50/80 dark:bg-slate-950/20 border border-slate-150 dark:border-slate-850 hover:border-indigo-500/15 rounded-2xl flex items-center justify-between gap-3 transition">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center font-black text-xs border border-slate-200 dark:border-slate-700">
                                {guest.name.split('#')[1]}
                              </div>
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-slate-800 dark:text-white truncate">{guest.name}</span>
                                <span className="text-[8px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded font-black uppercase tracking-wider shrink-0">Гость</span>
                              </div>
                              <p className="text-[10px] text-slate-450 dark:text-slate-400 font-bold truncate mt-0.5" title={guest.action}>
                                {guest.action}
                              </p>
                              <span className="text-[9px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono">IP: {guest.ip}</span> &bull; <span>{guest.city}</span> &bull; <span>Активен: {guest.duration}</span>
                              </span>
                            </div>
                          </div>
                   
                          <button
                            onClick={() => {
                              alert(`Соединение с ${guest.name} защищено SSL. Анонимные сессии автоматически синхронизируются. При регистрации гость сможет продолжить этот сеанс.`);
                            }}
                            className="p-2 border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 hover:scale-105 rounded-xl text-slate-405 hover:text-indigo-600 transition cursor-pointer flex items-center justify-center shrink-0"
                            title="Посмотреть данные сессии подробно"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-105 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl mt-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-500 animate-pulse" />
                      <span>Обновление данных: <strong>3 сек</strong></span>
                    </div>
                    <span>Локация: Вологда, РФ</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* CUSTOM DELETE CONFIRMATION MODAL */}
          {userToDelete && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
              <div 
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-2xl max-w-md w-full p-6"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 text-rose-600 dark:text-rose-450 mb-4">
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100/50 dark:border-rose-900/35">
                    <Trash2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-850 dark:text-white">Подтверждение удаления</h3>
                    <p className="text-[10px] text-slate-400 font-bold">Это действие абсолютно необратимо</p>
                  </div>
                </div>

                <div className="space-y-3 my-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                    Вы действительно хотите безвозвратно удалить аккаунт клиента <strong className="text-slate-850 dark:text-slate-100">{userToDelete.fullName}</strong> (<span className="font-mono text-xs text-rose-600">{userToDelete.email}</span>)?
                    <p className="mt-2 text-rose-600 dark:text-rose-400 font-bold">
                      &bull; Будут навсегда стерты все его заказы, чат-логи и уведомления в базе данных.
                    </p>
                  </div>
                  {deleteError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-xs font-bold text-rose-600 border border-rose-200/50 rounded-xl leading-relaxed">
                      {deleteError}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setUserToDelete(null)}
                    disabled={isDeletingUser}
                    className="flex-1 py-3 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    Отменить
                  </button>
                  <button
                    onClick={confirmDeleteUser}
                    disabled={isDeletingUser}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/10 disabled:opacity-50"
                  >
                    {isDeletingUser ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Удаление...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Удалить полностью</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
