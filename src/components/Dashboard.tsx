/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, Order, ChatMessage, Notification, PrintFile, FileFormatGroup, PaymentStatus, OrderStatus } from '../types';
import { ThemeToggle } from './ThemeToggle';
import { UserAvatar } from './UserAvatar';
import { 
  FileText, Upload, Trash2, Sliders, FileType, CheckCircle, Clock, 
  Send, MessageSquare, AlertCircle, Sparkles, CreditCard, Shield, 
  FileCheck, LogOut, Check, ArrowDown, Bell, HelpCircle, Laptop,
  UserCheck, Layers, RefreshCw, Smartphone, Phone, Star, Trophy, Award, Share2, Copy, Mail, Gift,
  Maximize2, Eye, ZoomIn, ZoomOut, RotateCw
} from 'lucide-react';
import { 
  calculateOrderCost, getFileFormatGroup, formatFileSize, 
  formatDateTime, getStatusLabel, getStatusColor, 
  getPaymentStatusLabel, getPaymentStatusColor, printInvoiceHTML,
  getClientTierForUser, isWorkingHours
} from '../utils';
import { db, doc, setDoc, storage, ref, uploadBytes, getDownloadURL } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';

// Synthesized high-quality feedback sound chimes using Web Audio API
function playPlaceOrderSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(330, now); // E4
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12); // E5
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  } catch (err) {
    console.warn(err);
  }
}

function playOrderSuccessSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // Play a beautiful dual-tone ascending success fanfare
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
    
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);
    
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc2.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.18); // C6
        
        gain2.gain.setValueAtTime(0.1, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.35);
      } catch (e) {}
    }, 80);
  } catch (err) {
    console.warn(err);
  }
}

// Helper function to count PDF pages client-side using cross-references scanner
async function countPdfPages(file: File): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          resolve(1);
          return;
        }
        const textDecoder = new TextDecoder('utf-8');
        const text = textDecoder.decode(new Uint8Array(arrayBuffer));
        // Search for Pages count attribute
        const pagesMatches = text.match(/\/Type\s*\/Pages\s*\/Count\s*(\d+)/g);
        if (pagesMatches && pagesMatches.length > 0) {
          const counts = pagesMatches.map(m => {
            const numMatch = m.match(/\d+/);
            return numMatch ? parseInt(numMatch[0], 10) : 1;
          });
          resolve(Math.max(...counts));
          return;
        }
        const countMatches = text.match(/\/Count\s*(\d+)/g);
        if (countMatches && countMatches.length > 0) {
          const counts = countMatches.map(m => {
            const numMatch = m.match(/\d+/);
            return numMatch ? parseInt(numMatch[0], 10) : 1;
          }).filter(c => c < 100000);
          if (counts.length > 0) {
            resolve(Math.max(...counts));
            return;
          }
        }
      } catch (err) {
        console.warn('PDF Count pages error:', err);
      }
      resolve(1);
    };
    reader.onerror = () => resolve(1);
    reader.readAsArrayBuffer(file);
  });
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
  database: {
    users: User[];
    orders: Order[];
    chatMessages: ChatMessage[];
    notifications: Notification[];
  };
  onUpdateDatabase: (updatedData: {
    orders?: Order[];
    chatMessages?: ChatMessage[];
    notifications?: Notification[];
    users?: User[];
  }) => void;
  onDeleteAccount: (userId: string) => void;
}

export function Dashboard({ user, onLogout, database, onUpdateDatabase, onDeleteAccount }: DashboardProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'upload' | 'orders' | 'chat' | 'profile'>('upload');
  
  // Visual Theme Customizer
  const [designTheme, setDesignTheme] = useState<'blue' | 'kraft' | 'cyber'>(() => {
    return (localStorage.getItem('print_shop_design_theme') as 'blue' | 'kraft' | 'cyber') || 'blue';
  });

  useEffect(() => {
    const root = document.documentElement;
    
    if (designTheme === 'blue') {
      // Restore default blue/indigo enterprise colors
      root.style.removeProperty('--color-indigo-50');
      root.style.removeProperty('--color-indigo-100');
      root.style.removeProperty('--color-indigo-200');
      root.style.removeProperty('--color-indigo-300');
      root.style.removeProperty('--color-indigo-400');
      root.style.removeProperty('--color-indigo-500');
      root.style.removeProperty('--color-indigo-600');
      root.style.removeProperty('--color-indigo-700');
      root.style.removeProperty('--color-indigo-800');
      root.style.removeProperty('--color-indigo-900');
      root.style.removeProperty('--color-indigo-950');
      
      root.style.removeProperty('--color-slate-50');
      root.style.removeProperty('--color-slate-950');
    } else if (designTheme === 'kraft') {
      // Emerald Green variables for primary color
      root.style.setProperty('--color-indigo-50', '#ecfdf5');
      root.style.setProperty('--color-indigo-100', '#d1fae5');
      root.style.setProperty('--color-indigo-200', '#a7f3d0');
      root.style.setProperty('--color-indigo-300', '#6ee7b7');
      root.style.setProperty('--color-indigo-400', '#34d399');
      root.style.setProperty('--color-indigo-500', '#10b981');
      root.style.setProperty('--color-indigo-600', '#059669'); // Emerald Forest
      root.style.setProperty('--color-indigo-700', '#047857');
      root.style.setProperty('--color-indigo-800', '#065f46');
      root.style.setProperty('--color-indigo-900', '#064e3b');
      root.style.setProperty('--color-indigo-950', '#022c22');
      
      // Warm Recycled Creamy Kraft Paper background overrides
      root.style.setProperty('--color-slate-50', '#fdfbf7');
      root.style.setProperty('--color-slate-950', '#060a0f');
    } else if (designTheme === 'cyber') {
      // Glowing Neon Purple/Violet variables for primary color
      root.style.setProperty('--color-indigo-50', '#faf5ff');
      root.style.setProperty('--color-indigo-100', '#f3e8ff');
      root.style.setProperty('--color-indigo-200', '#e9d5ff');
      root.style.setProperty('--color-indigo-300', '#d8b4fe');
      root.style.setProperty('--color-indigo-400', '#c084fc');
      root.style.setProperty('--color-indigo-500', '#a855f7');
      root.style.setProperty('--color-indigo-600', '#8b5cf6'); // Violet Neon Pulse
      root.style.setProperty('--color-indigo-700', '#7c3aed');
      root.style.setProperty('--color-indigo-800', '#6d28d9');
      root.style.setProperty('--color-indigo-900', '#581c87');
      root.style.setProperty('--color-indigo-950', '#120224');
      
      // Absolute Cyber-Midnight Dark Background
      root.style.setProperty('--color-slate-50', '#f8f9fc');
      root.style.setProperty('--color-slate-950', '#020308');
    }
    
    // Dispatch custom event to broadcast design theme changes if other components need to listen
    window.dispatchEvent(new CustomEvent('print_shop_theme_changed', { detail: designTheme }));
    localStorage.setItem('print_shop_design_theme', designTheme);
  }, [designTheme]);
  
  // Profile edit states
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [editFullName, setEditFullName] = useState(user.fullName);
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editAvatarUrl, setEditAvatarUrl] = useState(user.avatarUrl || '');
  const [editAvatarScale, setEditAvatarScale] = useState(user.avatarScale || 1);
  const [editAvatarX, setEditAvatarX] = useState(user.avatarX || 0);
  const [editAvatarY, setEditAvatarY] = useState(user.avatarY || 0);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const fileRef = ref(storage, `avatars/${user.id}_${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      
      const updatedUsers = database.users.map(u => {
        if (u.id === user.id) {
          return {
            ...u,
            avatarUrl: downloadUrl
          };
        }
        return u;
      });
      
      setEditAvatarUrl(downloadUrl);
      onUpdateDatabase({ users: updatedUsers });
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setAvatarUploading(false);
    }
  };

  // Keep edits synced with user updates
  useEffect(() => {
    setEditFullName(user.fullName);
    setEditPhone(user.phone || '');
    setEditAvatarUrl(user.avatarUrl || '');
    setEditAvatarScale(user.avatarScale || 1);
    setEditAvatarX(user.avatarX || 0);
    setEditAvatarY(user.avatarY || 0);
  }, [user.fullName, user.phone, user.avatarUrl, user.avatarScale, user.avatarX, user.avatarY]);

  // Keep client online status synced in Firestore
  useEffect(() => {
    if (!user || !user.id) return;
    
    const setOnlineState = async (online: boolean) => {
      try {
        const userDocRef = doc(db, 'users', user.id);
        await setDoc(userDocRef, { 
          isOnline: online, 
          lastActiveAt: new Date().toISOString() 
        }, { merge: true });
      } catch (err) {
        // Silent recovery
      }
    };

    setOnlineState(true);

    const interval = setInterval(() => {
      setOnlineState(true);
    }, 45000);

    const handleUnload = () => {
      setOnlineState(false);
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      setOnlineState(false);
    };
  }, [user.id]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFullName.trim()) return;

    const updatedUsers = database.users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          fullName: editFullName.trim(),
          phone: editPhone.trim(),
          avatarUrl: editAvatarUrl.trim(),
          avatarScale: editAvatarScale,
          avatarX: editAvatarX,
          avatarY: editAvatarY
        };
      }
      return u;
    });

    onUpdateDatabase({ users: updatedUsers });
    setIsEditingProfile(false);
  };
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<PrintFile[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Print properties state
  const [paperType, setPaperType] = useState<'standard' | 'glossy' | 'matte' | 'kraft' | 'standard_a3' | 'bw_a3'>('standard');
  const [photoSize, setPhotoSize] = useState<'10*15' | '13*18' | '15*20' | '20*30'>('10*15');
  const [previewFile, setPreviewFile] = useState<PrintFile | null>(null);
  const [paperDensity, setPaperDensity] = useState<string>('regular');
  const [printColor, setPrintColor] = useState<'bw' | 'color' | 'color_full'>('bw');
  const [copies, setCopies] = useState<number>(1);
  const [binding, setBinding] = useState<'none' | 'staple' | 'file' | 'spring_plastic' | 'spring_metal' | 'hard_cover'>('none');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<string | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [showTornPaperAnimation, setShowTornPaperAnimation] = useState(false);
  const [tornPromoCode, setTornPromoCode] = useState<string>('');

  const getActivePromo = () => {
    if (appliedPromo) return appliedPromo;
    const typed = promoCode.trim().toUpperCase();
    if (
      typed === 'PROMO10' ||
      typed === 'STUDENT15' ||
      typed === 'WELCOME5' ||
      typed === 'FIRSTFREE' ||
      typed === 'COPYMAX' ||
      (user.promoCode && typed === user.promoCode.trim().toUpperCase())
    ) {
      return typed;
    }
    return null;
  };

  const getActiveDiscountPercent = (activePromoCode: string | null) => {
    if (!activePromoCode) return 0;
    const code = activePromoCode.trim().toUpperCase();
    if (code === 'PROMO10') return 10;
    if (code === 'STUDENT15') return 15;
    if (code === 'WELCOME5') return 5;
    if (code === 'FIRSTFREE') return 20;
    if (code === 'COPYMAX') return 50;
    if (user.promoCode && code === user.promoCode.trim().toUpperCase()) {
      return user.promoDiscount || 0;
    }
    const match = code.match(/^GIFT(\d+)$/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  };

  // Gift Promo System state
  const [showPromoGiftModal, setShowPromoGiftModal] = useState(false);
  const [show3DMockupModal, setShow3DMockupModal] = useState(false);
  const [mockRotateX, setMockRotateX] = useState<number>(25);
  const [mockRotateY, setMockRotateY] = useState<number>(15);
  const [mockScale, setMockScale] = useState<number>(1.2);

  // Trigger gift modal when a new promo is gifted to user
  useEffect(() => {
    if (user.promoCode && user.promoGiftedSeen === false) {
      setShowPromoGiftModal(true);
    }
  }, [user.promoCode, user.promoGiftedSeen]);

  // Auto-dismiss the tearing animation after 5 seconds
  useEffect(() => {
    if (showTornPaperAnimation) {
      const timer = setTimeout(() => {
        setShowTornPaperAnimation(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showTornPaperAnimation]);

  // Payment popup state
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'sbp' | 'qr' | 'on_receipt'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);
  const [confettiActive, setConfettiActive] = useState(false);

  // Live chat state
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Notification states
  const [pushConsent, setPushConsent] = useState<'default' | 'granted' | 'denied'>(() => {
    return (localStorage.getItem('print_shop_push_consent') as any) || 'default';
  });
  const [showInAppPush, setShowInAppPush] = useState<string | null>(null);

  // Filter state for orders
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Order file deletion state
  const [fileToConfirmDelete, setFileToConfirmDelete] = useState<{ orderId: string; fileId: string } | null>(null);

  const canDeleteFileFromOrder = (ord: Order) => {
    return ord.status === 'pending' || ord.status === 'approved';
  };

  const handleDeleteFileFromOrder = (orderId: string, fileId: string) => {
    const order = database.orders.find(o => o.id === orderId);
    if (!order) return;

    if (!canDeleteFileFromOrder(order)) return;

    const updatedFiles = order.files.filter(f => f.id !== fileId);

    let updatedOrders;
    if (updatedFiles.length === 0) {
      // If no files are left, delete the entire order
      updatedOrders = database.orders.filter(o => o.id !== orderId);
      
      const newNotif = {
        id: 'n_' + Date.now(),
        userId: user.id,
        title: "Заказ отменен",
        body: `Все файлы удалены. Заказ ${orderId} автоматически отменен и удален из базы.`,
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
    setFileToConfirmDelete(null);
  };

  // Account Self-Delete Modal State
  const [showSelfDeleteModal, setShowSelfDeleteModal] = useState(false);
  const [isDeletingSelf, setIsDeletingSelf] = useState(false);
  const [selfDeleteError, setSelfDeleteError] = useState<string | null>(null);

  // Filter database objects belonging to this user
  const userOrders = database.orders.filter(o => o.userId === user.id);
  const userNotifications = database.notifications.filter(n => n.userId === user.id);
  const userChats = database.chatMessages.filter(c => c.userId === user.id);

  // Unread badge indicators
  const unreadChatsCount = userChats.filter(c => c.senderRole === 'admin' && !c.readByClient).length;
  const unreadNotificationsCount = userNotifications.filter(n => !n.read).length;

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, userChats.length]);

  // Mark chats as read when opening Chat tab
  useEffect(() => {
    if (activeTab === 'chat' && unreadChatsCount > 0) {
      const updatedChats = database.chatMessages.map(c => {
        if (c.userId === user.id && c.senderRole === 'admin') {
          return { ...c, readByClient: true };
        }
        return c;
      });
      onUpdateDatabase({ chatMessages: updatedChats });
    }
  }, [activeTab]);

  // Mark notifications as read when opening profile / or general
  const handleMarkNotificationsRead = () => {
    const updatedNotifs = database.notifications.map(n => {
      if (n.userId === user.id) {
        return { ...n, read: true };
      }
      return n;
    });
    onUpdateDatabase({ notifications: updatedNotifs });
  };

  // Monitor status updates in background and trigger browser / simulated push notifications
  const [lastCheckOrders, setLastCheckOrders] = useState<Record<string, string>>({});
  useEffect(() => {
    // Collect mapping of order id to status
    const currentStatuses: Record<string, string> = {};
    userOrders.forEach(o => {
      currentStatuses[o.id] = o.status;
    });

    // Check if any status changed since last check
    let changedOrder: { id: string; oldS: string; newS: string } | null = null;
    if (Object.keys(lastCheckOrders).length > 0) {
      for (const [id, s] of Object.entries(currentStatuses)) {
        if (lastCheckOrders[id] && lastCheckOrders[id] !== s) {
          changedOrder = { id, oldS: lastCheckOrders[id], newS: s };
          break;
        }
      }
    }

    if (changedOrder) {
      // Create notification record in DB list
      const title = 'Статус заказа обновлен!';
      const body = `Заказ ${changedOrder.id} изменил статус на: "${getStatusLabel(changedOrder.newS as any)}"`;
      
      const newNotif: Notification = {
        id: 'n_' + Date.now(),
        userId: user.id,
        title,
        body,
        timestamp: new Date().toISOString(),
        read: false,
        type: 'order_status'
      };

      onUpdateDatabase({
        notifications: [newNotif, ...database.notifications]
      });

      // Show in-app banner
      setShowInAppPush(`${title} \n ${body}`);
      setTimeout(() => setShowInAppPush(null), 5000);

      // Trigger actual HTML5 system Notification if permitted
      if (pushConsent === 'granted' && 'Notification' in window) {
        new window.Notification(title, { body });
      }
    }

    setLastCheckOrders(currentStatuses);
  }, [JSON.stringify(userOrders.map(o => o.status))]);

  // File Upload Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const uploadFileToFirebaseStorage = async (file: File, fileId: string) => {
    try {
      const fileRef = ref(storage, `users/${user.id}/files/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, url: downloadUrl } : f));
    } catch (error) {
      console.error('Firebase Storage upload error for fileId ' + fileId + ':', error);
    }
  };

  const handleFiles = (filesList: FileList | File[]) => {
    if (!isWorkingHours()) {
      setUploadError("К сожалению, приём файлов приостановлен во внерабочее время. Мы работаем: Пн-Пт 09:00-19:00, Сб-Вс 10:00-19:00.");
      return;
    }
    setUploadError(null);
    const newFiles: PrintFile[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const formatGroup = getFileFormatGroup(file.name);
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const fileId = 'file_' + Date.now() + '_' + i + '_' + Math.floor(Math.random() * 1000);
      
      let previewUrl = '';
      if (file.type.startsWith('image/') || formatGroup === 'image' || isPdf) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch (e) {
          console.error('Error creating object URL:', e);
        }
      }

      newFiles.push({
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        formatGroup,
        pageCount: isPdf ? undefined : 1,
        previewUrl: previewUrl || undefined
      });

      if (isPdf) {
        countPdfPages(file).then(pages => {
          setUploadedFiles(prev => prev.map(f => f.id === fileId ? { ...f, pageCount: pages } : f));
        });
      }

      // Upload file directly to Firebase Storage bucket asynchronously
      uploadFileToFirebaseStorage(file, fileId);
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);

    // Create system notification for uploaded file
    const newNotif: Notification = {
      id: 'n_up_' + Date.now(),
      userId: user.id,
      title: 'Успешная загрузка',
      body: `Загружено файлов: ${filesList.length} шт. Добавьте параметры печати для заказа.`,
      timestamp: new Date().toISOString(),
      read: false,
      type: 'profile'
    };
    onUpdateDatabase({
      notifications: [newNotif, ...database.notifications]
    });
  };

  // Add listener for PWA Web Share Target
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('shared-target')) {
      // Clear query params immediately
      window.history.replaceState({}, '', '/');

      const processSharedItems = async () => {
        try {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('PWA_Share_Target_DB', 1);
            request.onsuccess = (e: any) => resolve(e.target.result);
            request.onerror = (e: any) => reject(e.target.error);
          });

          if (!db.objectStoreNames.contains('shared_items')) {
            return;
          }

          const items: any[] = await new Promise((resolve, reject) => {
            const transaction = db.transaction('shared_items', 'readonly');
            const store = transaction.objectStore('shared_items');
            const requestAll = store.getAll();
            requestAll.onsuccess = () => resolve(requestAll.result);
            requestAll.onerror = (e: any) => reject(e.target.error);
          });

          if (items && items.length > 0) {
            const filesToImport: File[] = [];

            for (const item of items) {
              if (item.file) {
                // Reconstruct actual file object
                const reconstructedFile = new File([item.file], item.name || 'shared_document', { 
                  type: item.type || 'application/octet-stream' 
                });
                filesToImport.push(reconstructedFile);
              } else if (item.text) {
                // Shared search text or shared urls
                const textFile = new File([item.text], 'shared_text.txt', { 
                  type: 'text/plain' 
                });
                filesToImport.push(textFile);
              }
            }

            if (filesToImport.length > 0) {
              handleFiles(filesToImport);
              setActiveTab('upload');
            }

            // Clear database store so we don't reload items
            const clearTransaction = db.transaction('shared_items', 'readwrite');
            const clearStore = clearTransaction.objectStore('shared_items');
            clearStore.clear();
          }
        } catch (err) {
          console.error('Error importing shared files via Web Share Target:', err);
        }
      };

      const t = setTimeout(() => {
        processSharedItems();
      }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  const removeUploadedFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Build the order from uploaded files
  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isWorkingHours()) {
      setUploadError("К сожалению, отправка заказов приостановлена во внерабочее время. Мы работаем: Пн-Пт 09:00-19:00, Сб-Вс 10:00-19:00.");
      return;
    }
    if (uploadedFiles.length === 0) return;

    const finalPromo = getActivePromo();
    const finalDiscount = finalPromo ? getActiveDiscountPercent(finalPromo) : undefined;

    const calculatedDensity = (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity;
    const totalCost = calculateOrderCost(
      uploadedFiles.length,
      copies,
      paperType,
      printColor,
      calculatedDensity,
      uploadedFiles,
      (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
      binding,
      finalPromo || undefined,
      finalDiscount
    );
    const orderId = `ORD-${1000 + database.orders.length + 1}`;

    const newOrder: Order = {
      id: orderId,
      userId: user.id,
      userName: user.fullName,
      userEmail: user.email,
      files: uploadedFiles,
      orderDate: new Date().toISOString(),
      status: 'pending',
      totalCost,
      paymentStatus: 'unpaid',
      paperType,
      paperDensity: calculatedDensity,
      photoSize: (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
      printColor,
      copies,
      notes: notes.trim(),
      binding,
      promoCode: finalPromo || undefined,
      promoDiscount: finalDiscount
    };

    const isPersonalPromo = user.promoCode && finalPromo === user.promoCode.trim().toUpperCase();
    let updatedUsers = database.users;

    if (isPersonalPromo) {
      setTornPromoCode(user.promoCode || '');
      setShowTornPaperAnimation(true);
      
      updatedUsers = database.users.map(u => {
        if (u.id === user.id) {
          const updatedUser = { ...u };
          delete updatedUser.promoCode;
          delete updatedUser.promoDiscount;
          delete updatedUser.promoGiftedSeen;
          return updatedUser;
        }
        return u;
      });
    }

    onUpdateDatabase({
      orders: [newOrder, ...database.orders],
      users: updatedUsers
    });

    // Clear uploader and options state
    setUploadedFiles([]);
    setNotes('');
    setBinding('none');
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
    
    // Jump to orders tab
    setActiveTab('orders');

    // Automatically prompt to pay this order
    setPayingOrder(newOrder);
    
    // Play a gentle confirm alert sound
    playPlaceOrderSound();
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    if (
      code === 'PROMO10' || 
      code === 'STUDENT15' || 
      code === 'WELCOME5' ||
      code === 'FIRSTFREE' ||
      code === 'COPYMAX' ||
      (user.promoCode && code === user.promoCode.trim().toUpperCase()) ||
      code.match(/^GIFT\d+$/)
    ) {
      setAppliedPromo(code);
      setPromoError(null);
      playPlaceOrderSound();
    } else {
      setPromoError('Неверный или истекший промокод');
      setAppliedPromo(null);
    }
  };

  const handleDismissPromoGift = (andApply: boolean = false) => {
    setShowPromoGiftModal(false);
    
    // Copy to clipboard
    if (user.promoCode) {
      navigator.clipboard.writeText(user.promoCode).catch(() => {});
      if (andApply) {
        setPromoCode(user.promoCode);
        setAppliedPromo(user.promoCode);
        setPromoError(null);
        playPlaceOrderSound();
      }
    }

    const updatedUsers = database.users.map(u => {
      if (u.id === user.id) {
        return {
          ...u,
          promoGiftedSeen: true
        };
      }
      return u;
    });
    onUpdateDatabase({ users: updatedUsers });
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoError(null);
  };

  // Simulated Payment Systems Checkout Processor
  const processSecurePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOrder) return;

    setIsProcessingPayment(true);

    setTimeout(() => {
      // Transition out
      setIsProcessingPayment(false);
      setPaymentCompleted(true);
      setConfettiActive(true);
      setTimeout(() => setConfettiActive(false), 5000);

      setTimeout(() => {
        // Play payment success chime
        playOrderSuccessSound();
        
        // Complete the order state update in db
        const txnId = 'TXN-' + Math.floor(100000000 + Math.random() * 900000000);
        const isOnReceipt = paymentMethod === 'on_receipt';
        
        const updatedOrders = database.orders.map(ord => {
          if (ord.id === payingOrder.id) {
            return {
              ...ord,
              paymentStatus: (isOnReceipt ? 'unpaid' : 'paid') as PaymentStatus,
              paymentMethod: paymentMethod === 'card' 
                ? 'Банковская карта' 
                : paymentMethod === 'sbp' 
                ? 'СБП (Система быстрых платежей)' 
                : paymentMethod === 'qr' 
                ? 'Оплата по QR-коду' 
                : 'При получении (Наличные/Карта)',
              transactionId: isOnReceipt ? undefined : txnId,
              status: 'approved' as const // change pending to approved after payment or on_receipt confirmation
            };
          }
          return ord;
        });

        // Push print notifications
        const successNotif: Notification = {
          id: 'pay_' + Date.now(),
          userId: user.id,
          title: isOnReceipt ? 'Заказ подтвержден!' : 'Оплата получена!',
          body: isOnReceipt 
            ? `Заказ ${payingOrder.id} принят к печати. Оплата ₽${payingOrder.totalCost} производится при получении в филиале.`
            : `Заказ ${payingOrder.id} успешно оплачен на сумму ₽${payingOrder.totalCost}. Копии отправлены на ПК для печати.`,
          timestamp: new Date().toISOString(),
          read: false,
          type: 'payment'
        };

        // Standard automated welcome computer chat reply
        const autoReply: ChatMessage = {
          id: 'chat_pay_rep_' + Date.now(),
          userId: user.id,
          senderId: 'u1', // Admin ID
          senderRole: 'admin',
          senderName: 'Дмитрий (Администратор)',
          message: isOnReceipt 
            ? `Здравствуйте, ${user.fullName}! Ваш заказ ${payingOrder.id} на сумму ₽${payingOrder.totalCost} принят в работу с оплатой при получении. Файлы уже загружены, я приступаю к печати. Вы сможете расплатиться картой или наличными при выдаче!`
            : `Здравствуйте, ${user.fullName}! Оплату по заказу ${payingOrder.id} на сумму ₽${payingOrder.totalCost} успешно получили. Файлы уже загружены ко мне на ПК. Я приступаю к печати, вышлю статус готовности!`,
          timestamp: new Date().toISOString(),
          readByAdmin: true,
          readByClient: false
        };

        onUpdateDatabase({
          orders: updatedOrders,
          notifications: [successNotif, ...database.notifications],
          chatMessages: [...database.chatMessages, autoReply]
        });

        // Close modal
        setPayingOrder(null);
        setPaymentCompleted(false);
        setCardNumber('');
        setCardExpiry('');
        setCardCvv('');

      }, 1500);

    }, 2000);
  };

  // Client side message sending
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const newMsg: ChatMessage = {
      id: 'c_' + Date.now(),
      userId: user.id,
      senderId: user.id,
      senderRole: 'client',
      senderName: user.fullName,
      message: chatInput.trim(),
      timestamp: new Date().toISOString(),
      readByAdmin: false,
      readByClient: true
    };

    onUpdateDatabase({
      chatMessages: [...database.chatMessages, newMsg]
    });

    setChatInput('');

    // Simulate smart Admin AI/Staff quick auto interaction after 2.5 seconds
    setTimeout(() => {
      let responseText = '';
      if (!isWorkingHours()) {
        responseText = `Здравствуйте! К сожалению, сейчас нерабочее время. Пожалуйста, обращайтесь в рабочие часы:\n\n📅 Пн-Пт: 09:00 — 19:00\n📅 Сб-Вс: 10:00 — 19:00\n\nВ нерабочее время новые заказы/файлы не принимаются и консультации не проводятся. Ждем вас в рабочее время!`;
      } else {
        const activePendingOrders = database.orders.filter(o => o.userId === user.id && o.status !== 'printed');
        responseText = `Добрый день! Ваш файл у меня на компьютере. Мы подготавливаем печатную партию. Будет сделано в лучшем виде!`;
        
        if (activePendingOrders.length > 0) {
          const targetO = activePendingOrders[0];
          responseText = `Ваш заказ ${targetO.id} со статусом "${getStatusLabel(targetO.status as any)}" прямо сейчас в приоритете. Ожидайте уведомление о полной готовности в кабинете!`;
        }
      }

      const adminReply: ChatMessage = {
        id: 'c_auto_' + Date.now(),
        userId: user.id,
        senderId: 'u1',
        senderRole: 'admin',
        senderName: 'Дмитрий (Администратор)',
        message: responseText,
        timestamp: new Date().toISOString(),
        readByAdmin: true,
        readByClient: false
      };

      onUpdateDatabase({
        chatMessages: [...database.chatMessages, newMsg, adminReply]
      });

      // Show in-app notice
      setShowInAppPush(`Новое сообщение от Администратора в чате.`);
      setTimeout(() => setShowInAppPush(null), 4000);

    }, 2500);
  };

  const handleRequestPushPermission = () => {
    if ('Notification' in window) {
      window.Notification.requestPermission().then(status => {
        setPushConsent(status);
        localStorage.setItem('print_shop_push_consent', status);
      });
    } else {
      setPushConsent('denied');
    }
  };

  // Clean Account Delete
  const handleDeleteSelf = () => {
    setShowSelfDeleteModal(true);
  };

  const confirmDeleteSelf = async () => {
    setIsDeletingSelf(true);
    setSelfDeleteError(null);
    try {
      await onDeleteAccount(user.id);
    } catch (err) {
      console.error('Failed to self delete account:', err);
      setSelfDeleteError('Не удалось удалить личный кабинет. Пожалуйста, проверьте интернет-соединение и попробуйте еще раз.');
      setIsDeletingSelf(false);
    }
  };

  return (
    <div id="client-dashboard-root" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row transition-colors duration-300 relative overflow-hidden">
      
      {/* Exquisite Graphic 3D background glows inspired by Premium Theme 2 (Cozy Glassmorphic with soft pastel glow) */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full bg-violet-400/12 dark:bg-violet-600/15 blur-[130px] animate-glow-slow-1 pointer-events-none" />
      <div className="absolute bottom-[20%] right-[10%] w-[550px] h-[550px] rounded-full bg-pink-400/12 dark:bg-pink-600/15 blur-[140px] animate-glow-slow-2 pointer-events-none" />
      <div className="absolute top-[60%] left-[-10%] w-[400px] h-[400px] rounded-full bg-cyan-400/8 dark:bg-cyan-600/10 blur-[120px] animate-glow-slow-1 pointer-events-none" />

      {/* Floating 3D Frosted Glass Orbs mirroring the uploaded design */}
      <div className="glass-bg-orb w-[200px] h-[200px] top-[15%] left-[10%] opacity-65 animate-[float-slow_24s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(15px) saturate(120%)' }} />
      <div className="glass-bg-orb w-[250px] h-[250px] bottom-[25%] right-[12%] opacity-80 animate-[float-reverse_28s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(20px) saturate(130%)' }} />
      <div className="glass-bg-orb w-[150px] h-[150px] top-[65%] left-[-2%] opacity-60 animate-[float-slow_30s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(12px) saturate(110%)' }} />
      <div className="glass-bg-orb w-[110px] h-[110px] top-[35%] right-[22%] opacity-50 animate-[float-reverse_26s_infinite_ease-in-out]" style={{ backdropFilter: 'blur(10px) saturate(100%)' }} />

      {/* Visual In-App Toast Indicator */}
      {showInAppPush && (
        <div className="fixed top-5 right-5 z-55 max-w-sm bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex items-start gap-3 border border-blue-500 animate-bounce">
          <Bell className="w-5 h-5 shrink-0 text-white animate-pulse mt-0.5 unicode-3d-svg" />
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider">УВЕДОМЛЕНИЕ О ЗАКАЗЕ</h4>
            <p className="text-xs text-blue-100 whitespace-pre-line mt-1">{showInAppPush}</p>
          </div>
        </div>
      )}

      {/* LEFT NAVIGATION COLUMN - Responsive Responsive Sidebar */}
      <aside className="w-full md:w-64 border-s-0 md:border-r border-b md:border-b-0 border-pink-500/10 bg-[#160d2e]/85 backdrop-blur-xl text-white shrink-0 flex flex-row md:flex-col justify-between p-4 md:py-6 md:px-5 transition-colors relative z-10">
        
        {/* Brand / Mini Logo */}
        <div className="hidden md:flex items-center gap-3 mb-8">
          <div className="squircle-3d-tile tile-3d-orange w-11 h-11 shrink-0 scale-105 shadow-lg">
            <FileText className="w-5 h-5 text-white icon-3d-svg" />
          </div>
          <div>
            <h2 className="text-md font-bold tracking-tight text-white leading-tight">Фото-Север</h2>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#a5b4fc]">Северное шоссе, 18</span>
          </div>
        </div>

        {/* Sync Indicator */}
        <div className="hidden md:flex items-center gap-2 mb-6 px-3 py-2 bg-slate-900/40 dark:bg-black/30 border border-slate-800 dark:border-slate-850 rounded-xl text-[11px] text-[#cbd5e1]">
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400 icon-3d-svg" />
          <span className="font-medium">Мульти-автосинхронизация</span>
        </div>

        {/* Nav Links */}
        <nav className="flex md:flex-col flex-1 gap-2.5 md:gap-2 justify-around md:justify-start w-full relative">
          <button
            onClick={() => setActiveTab('upload')}
            className={`relative flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial cursor-pointer ${
              activeTab === 'upload' 
                ? 'text-white font-black' 
                : 'text-[#cbd5e1] hover:bg-slate-800/40 hover:text-white'
            }`}
          >
            {activeTab === 'upload' && (
              <motion.div 
                layoutId="active-sidebar-pill"
                className="absolute inset-0 bg-white/15 dark:bg-white/10 rounded-2xl -z-10 shadow-inner border border-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <div className={`squircle-3d-tile tile-3d-cyber w-9 h-9 shrink-0 ${activeTab === 'upload' ? 'squircle-3d-active scale-105' : 'opacity-90'}`}>
              <Upload className="w-4.5 h-4.5 text-white icon-3d-svg" />
            </div>
            <span className="hidden sm:inline z-10">Загрузка и Заказ</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`relative flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial cursor-pointer ${
              activeTab === 'orders' 
                ? 'text-white font-black' 
                : 'text-[#cbd5e1] hover:bg-slate-800/40 hover:text-white'
            }`}
          >
            {activeTab === 'orders' && (
              <motion.div 
                layoutId="active-sidebar-pill"
                className="absolute inset-0 bg-white/15 dark:bg-white/10 rounded-2xl -z-10 shadow-inner border border-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <div className={`squircle-3d-tile tile-3d-violet w-9 h-9 shrink-0 relative ${activeTab === 'orders' ? 'squircle-3d-active scale-105' : 'opacity-90'}`}>
              <Clock className="w-4.5 h-4.5 text-white icon-3d-svg" />
              {userOrders.filter(o => o.status !== 'printed').length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#ef4444] z-10 animate-ping border border-white" />
              )}
            </div>
            <span className="hidden sm:inline z-10">Мои Заказы</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`relative flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial cursor-pointer ${
              activeTab === 'chat' 
                ? 'text-white font-black' 
                : 'text-[#cbd5e1] hover:bg-slate-800/40 hover:text-white'
            }`}
          >
            {activeTab === 'chat' && (
              <motion.div 
                layoutId="active-sidebar-pill"
                className="absolute inset-0 bg-white/15 dark:bg-white/10 rounded-2xl -z-10 shadow-inner border border-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <div className={`squircle-3d-tile tile-3d-green w-9 h-9 shrink-0 relative ${activeTab === 'chat' ? 'squircle-3d-active scale-105' : 'opacity-90'}`}>
              <MessageSquare className="w-4.5 h-4.5 text-white icon-3d-svg" />
              {unreadChatsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 animate-bounce border border-white shadow-md">
                  {unreadChatsCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline z-10">Чат с печатником</span>
          </button>

          <button
            onClick={() => { setActiveTab('profile'); handleMarkNotificationsRead(); }}
            className={`relative flex items-center gap-1.5 md:gap-3 px-3 py-2 md:py-2.5 text-xs sm:text-sm font-semibold rounded-2xl transition-all duration-200 justify-center md:justify-start flex-1 md:flex-initial cursor-pointer ${
              activeTab === 'profile' 
                ? 'text-white font-black' 
                : 'text-[#cbd5e1] hover:bg-slate-800/40 hover:text-white'
            }`}
          >
            {activeTab === 'profile' && (
              <motion.div 
                layoutId="active-sidebar-pill"
                className="absolute inset-0 bg-white/15 dark:bg-white/10 rounded-2xl -z-10 shadow-inner border border-white/10"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <div className={`squircle-3d-tile tile-3d-rainbow w-9 h-9 shrink-0 relative ${activeTab === 'profile' ? 'squircle-3d-active scale-105' : 'opacity-90'}`}>
              <UserCheck className="w-4.5 h-4.5 text-white icon-3d-svg" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center z-10 border border-white shadow-md">
                  {unreadNotificationsCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline z-10">Кабинет & Инфо</span>
          </button>
        </nav>

        {/* Short info bottom */}
        <div className="hidden md:block border-t border-slate-850 pt-5 mt-auto">
          <div className="flex items-center gap-3">
            <UserAvatar
              user={user}
              className="w-10 h-10 rounded-xl ring-2 ring-indigo-500/20 shrink-0"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user.fullName}</p>
              <p className="text-[10px] text-[#cbd5e1] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-450 hover:text-white hover:bg-rose-600 rounded-xl transition-all border border-rose-900/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Выйти из кабинета
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50/40 dark:bg-slate-950/50 backdrop-blur-md relative z-10">
        
        {/* Top bar on small / medium devices for header */}
        <header id="dashboard-header" className="md:hidden flex items-center justify-between px-4 py-3 bg-white/70 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="squircle-3d-tile tile-3d-orange w-8 h-8 shrink-0 shadow-sm">
              <FileText className="w-4 h-4 text-white icon-3d-svg" />
            </div>
            <h1 className="text-sm font-black text-slate-900 dark:text-white leading-none">Фото-Север</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="p-1 px-2.5 bg-rose-50 border border-rose-200 dark:border-rose-950/40 text-rose-600 text-xs rounded-xl font-bold dark:bg-rose-950/20"
            >
              Выйти
            </button>
          </div>
        </header>

        <header className="hidden md:flex items-center justify-between px-8 py-5 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-800">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white">
              {activeTab === 'upload' && 'Загрузка документов для печати'}
              {activeTab === 'orders' && 'Статус печати в реальном времени'}
              {activeTab === 'chat' && 'Диалог с оператором типографии'}
              {activeTab === 'profile' && 'Личный кабинет и безопасность'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {activeTab === 'upload' && 'Загружайте любые форматы файлов и отправляйте нам'}
              {activeTab === 'orders' && 'Выгрузка актов, проведение защищенных интернет-транзакций, отслеживание выполнения заказа'}
              {activeTab === 'chat' && 'Моментальная обратная связь, согласование правок, уведомление об изменениях'}
              {activeTab === 'profile' && 'Управление учетными записями, очистка кеша, социальные связи'}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Native system notification requester */}
            {pushConsent === 'default' && (
              <button
                onClick={handleRequestPushPermission}
                className="flex items-center gap-2 py-1.5 px-3 bg-amber-500/10 hover:bg-amber-550/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl text-[11px] font-bold"
              >
                <Bell className="w-3.5 h-3.5" />
                Включить push статусы
              </button>
            )}
            {pushConsent === 'granted' && (
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 rounded-xl border border-emerald-500/20 font-bold">
                <Check className="w-3.5 h-3.5" /> Push включены
              </span>
            )}
            
            <ThemeToggle />
            <div className="text-indigo-600 dark:text-white bg-slate-100 dark:bg-slate-800 rounded-full w-9 h-9 flex items-center justify-center font-bold text-sm">
              {user.fullName[0].toUpperCase()}
            </div>
          </div>
        </header>

        {/* WORKSPACE SECTIONS */}
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto max-w-6xl w-full mx-auto">
          {user.promoCode && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-3xl p-5 border border-emerald-500/30 shadow-lg shadow-emerald-500/10 cursor-pointer relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 animate-pulse-slow"
              onClick={() => setShowPromoGiftModal(true)}
            >
              {/* background decorative shapes */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full pointer-events-none"></div>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="p-3 bg-white/10 dark:bg-slate-900/40 rounded-2xl border border-white/20 text-white shrink-0 animate-bounce">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider">У Вас есть персональный подарок! 🎁</h4>
                  <p className="text-xs text-white/80 mt-1 font-medium select-none">
                    Администратор подарил Вам новогодний промокод со скидкой <strong className="text-white text-sm">-{user.promoDiscount}%</strong>! Нажмите, чтобы открыть праздничную открытку со своим подарком.
                  </p>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPromoGiftModal(true);
                }}
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-emerald-700 font-black text-xs rounded-xl shadow-md transition shrink-0 relative z-10 cursor-pointer"
              >
                Открыть подарок 🎁
              </button>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {/* TAB 1: FILE UPLOADER & PROPERTIES */}
            {activeTab === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full"
              >
                
                {/* Interactive Step Timeline Indicator */}
                <div className="lg:col-span-12 bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-150 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm md:px-8 relative overflow-hidden">
                  {/* Decorative faint background glowing pattern */}
                  <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  
                  <div className="flex items-center gap-3.5 z-10">
                    <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center border transition-all duration-300 ${
                      uploadedFiles.length > 0
                        ? 'bg-emerald-500 text-white border-emerald-555'
                        : 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10'
                    }`}>
                      {uploadedFiles.length > 0 ? <Check className="w-4 h-4" /> : '1'}
                    </div>
                    <div>
                      <h4 className="text-[11px] font-black uppercase text-slate-800 dark:text-white tracking-wider flex items-center gap-1.5">
                        Шаг 1. Загрузка
                        {uploadedFiles.length > 0 && <span className="text-[9px] text-emerald-500 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded-md">ГОТОВО</span>}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-450 mt-0.5 font-bold">PDF, Скан-копии, Фото</p>
                    </div>
                  </div>

                  <div className="hidden md:block flex-1 h-[2px] border-t-2 border-dashed border-slate-200 dark:border-slate-800 mx-4" />

                  <div className="flex items-center gap-3.5 z-10">
                    <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center border transition-all duration-300 ${
                      uploadedFiles.length > 0
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10 animate-pulse'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-slate-150 dark:border-slate-850'
                    }`}>
                      2
                    </div>
                    <div>
                      <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                        uploadedFiles.length > 0 ? 'text-slate-800 dark:text-white' : 'text-slate-400 dark:text-slate-600'
                      }`}>Шаг 2. Опции печати</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-450 mt-0.5 font-bold">Бумага, Цвет, Переплет</p>
                    </div>
                  </div>

                  <div className="hidden md:block flex-1 h-[2px] border-t-2 border-dashed border-slate-200 dark:border-slate-800 mx-4" />

                  <div className="flex items-center gap-3.5 z-10">
                    <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center border transition-all duration-300 ${
                      uploadedFiles.length > 0
                        ? 'bg-gradient-to-br from-indigo-500 to-indigo-755 text-white border-indigo-500 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-400 border-slate-150 dark:border-slate-850'
                    }`}>
                      3
                    </div>
                    <div>
                      <h4 className={`text-[11px] font-black uppercase tracking-wider ${
                        uploadedFiles.length > 0 ? 'text-slate-800 dark:text-white flex items-center gap-1' : 'text-slate-400 dark:text-slate-600'
                      }`}>
                        Шаг 3. Итог & Чек
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-450 mt-0.5 font-bold">Быстрая оплата онлайн</p>
                    </div>
                  </div>
                </div>
              
              {/* Uploader Card */}
              <div className="lg:col-span-7 glass-cozy-card p-6 md:p-8 rounded-[32px] space-y-6">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="icon-3d-badge p-2 bg-indigo-50 dark:bg-indigo-950/40">
                    <Upload className="w-4 h-4 text-indigo-600 icon-3d-svg" />
                  </div>
                  <span>Шаг 1. Перетащите файлы</span>
                </h3>

                {!isWorkingHours() && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 p-5 rounded-2xl border border-rose-150 dark:border-rose-900/30 text-xs flex gap-3 shadow-sm">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <p className="font-extrabold text-sm">Копи-Центр сейчас закрыт!</p>
                      <p className="mt-1 leading-relaxed opacity-90">Мы принимаем файлы и оформляем новые заказы только в рабочие часы:</p>
                      <ul className="mt-1.5 space-y-1 font-extrabold text-[11px]">
                        <li>📅 Понедельник — Пятница: 09:00 — 19:00</li>
                        <li>📅 Суббота — Воскресенье: 10:00 — 19:00</li>
                      </ul>
                      <p className="mt-2.5 text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-450">Приём файлов и заказов временно заблокирован.</p>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 p-4 rounded-2xl border border-rose-200/40 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Drag zone Area */}
                <div
                  onDragEnter={!isWorkingHours() ? undefined : handleDrag}
                  onDragOver={!isWorkingHours() ? undefined : handleDrag}
                  onDragLeave={!isWorkingHours() ? undefined : handleDrag}
                  onDrop={!isWorkingHours() ? undefined : handleDrop}
                  onClick={!isWorkingHours() ? undefined : () => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all ${
                    !isWorkingHours()
                      ? 'border-rose-250 bg-rose-50/10 dark:bg-rose-950/5 cursor-not-allowed opacity-60'
                      : dragActive 
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-98 cursor-pointer' 
                      : 'border-slate-200 dark:border-slate-800 hover:border-indigo-500/60 dark:hover:border-indigo-500/40 bg-slate-50/50 dark:bg-slate-950/20 cursor-pointer'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                    accept=".zip,.rar,.7z,.doc,.docx,.pdf,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                  />
                  
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    !isWorkingHours()
                      ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-505 dark:text-rose-400'
                      : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400'
                  }`}>
                    {!isWorkingHours() ? <Clock className="w-8 h-8 animate-pulse text-rose-600" /> : <Upload className="w-8 h-8" />}
                  </div>
                  
                  <p className={`text-sm font-bold ${!isWorkingHours() ? 'text-rose-650 dark:text-rose-450' : 'text-slate-800 dark:text-white'}`}>
                    {!isWorkingHours() ? 'Прием файлов приостановлен (Центр Закрыт)' : 'Выберите файлы или перетащите их сюда'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {!isWorkingHours() 
                      ? 'Мы принимаем файлы только в рабочие часы Пн-Пт 09:00 - 19:00, Сб-Вс 10:00 - 19:00. Приходите к нам завтра!' 
                      : 'Поддерживаются любые типы форматов: архивы (zip, rar), изображения (jpg, png) и документы (pdf, docx, xlsx, txt) до 100 МБ.'
                    }
                  </p>
                </div>

                {/* Uploaded Queue Items */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-3.5">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl">
                      <span className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">
                        Список к отправке на печать ({uploadedFiles.length})
                      </span>
                      <button
                        onClick={() => setUploadedFiles([])}
                        className="text-xs text-rose-500 hover:text-rose-605 font-bold cursor-pointer"
                      >
                        Очистить всё
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                      {uploadedFiles.map(file => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between p-3.5 bg-slate-100/50 dark:bg-slate-950/30 rounded-2xl border border-slate-200/40 dark:border-slate-800/60 transition-colors"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shrink-0 text-indigo-600 shadow-sm">
                              <FileType className="w-5 h-5" />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                {file.name}
                              </p>
                              <span className="text-[10px] font-medium text-slate-400 block mt-0.5 animate-fade-in">
                                {formatFileSize(file.size)} &bull; {file.formatGroup.toUpperCase()} 
                                {file.pageCount !== undefined ? ` &bull; Скан: ${file.pageCount} стр.` : ' &bull; сканирование...'}
                                {file.url ? ' &bull; Облако: Загружено' : ' &bull; Загрузка в облако...'}
                                {file.previewUrl && <span onClick={(e) => { e.stopPropagation(); setPreviewFile(file); }} className="text-indigo-600 font-black ml-1.5 cursor-pointer hover:underline">&bull; &#128065; Предпросмотр</span>}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeUploadedFile(file.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-605 transition-colors cursor-pointer"
                            title="Удалить файл"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* INTERACTIVE PRINT MOCKUP PREVIEW VISUALIZER */}
                {uploadedFiles.length > 0 && (
                  <div className="pt-5 border-t border-slate-100 dark:border-slate-850 space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <span>Интерактивный 3D-макет партии</span>
                      </h4>
                      <span className="text-[10px] font-bold text-slate-405 dark:text-slate-550 italic">
                        Обновляется в реальном времени
                      </span>
                    </div>

                    <div 
                      onClick={() => setShow3DMockupModal(true)}
                      className="relative w-full aspect-video bg-gradient-to-br from-slate-150 to-slate-200 dark:from-slate-950 dark:to-slate-900 rounded-3xl border border-slate-200 dark:border-slate-850 p-6 flex items-center justify-center overflow-hidden shadow-inner cursor-pointer group hover:border-indigo-500/50 hover:shadow-indigo-500/5 transition-all duration-305"
                      title="Нажмите для подробного 3D-осмотра макета партии"
                    >
                      {/* Grid representation */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:16px_16px] opacity-25" />

                      {/* Explicit Interactive Focus Overlay */}
                      <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/15 dark:group-hover:bg-slate-950/30 flex items-center justify-center transition-all duration-300 z-30">
                        <div className="bg-white/95 dark:bg-slate-900/95 text-[11px] font-black text-indigo-600 dark:text-indigo-400 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transform translate-y-1 group-hover:translate-y-0 transition-all duration-300 border border-slate-200/55 dark:border-slate-800/80">
                          <Maximize2 className="w-3.5 h-3.5 animate-pulse" />
                          <span>Открыть макет во весь экран (ВТЧ в фокусе) 🔍</span>
                        </div>
                      </div>

                      {/* Stack effect loop */}
                      <div className="relative transition-transform duration-300 hover:scale-105 select-none my-6">
                        {Array.from({ length: Math.min(6, copies) }).map((_, i) => {
                          const isLast = i === Math.min(6, copies) - 1;
                          const offsetValueX = i * 4;
                          const offsetValueY = i * -4;
                          
                          let paperBg = 'bg-white text-slate-800'; 
                          if (paperType === 'kraft') {
                            paperBg = 'bg-[#eedbc5] dark:bg-[#c6a982] text-amber-955';
                          } else if (paperType === 'glossy') {
                            paperBg = 'bg-slate-50 text-slate-900';
                          } else if (paperType === 'matte') {
                            paperBg = 'bg-[#faf8f5] dark:bg-[#eae6df] text-slate-900';
                          }

                          return (
                            <div
                              key={i}
                              className={`rounded-xl border transition-all duration-300 flex flex-col justify-between p-4.5 shadow-[2px_2px_12px_rgba(0,0,0,0.1)] dark:shadow-[4px_4px_16px_rgba(0,0,0,0.4)] ${paperBg}`}
                              style={{
                                width: paperType === 'standard_a3' || paperType === 'bw_a3' ? '200px' : '170px',
                                height: paperType === 'standard_a3' || paperType === 'bw_a3' ? '280px' : '230px',
                                position: i === 0 ? 'relative' : 'absolute',
                                left: `${offsetValueX}px`,
                                bottom: `${offsetValueY}px`,
                                top: i === 0 ? 'auto' : `calc(0px + ${offsetValueY}px)`,
                                zIndex: i + 1,
                                borderWidth: '1px',
                                borderColor: paperType === 'kraft' ? '#b49265' : 'rgba(148, 163, 184, 0.4)',
                              }}
                            >
                              {/* Glare effect on Glossy paper */}
                              {paperType === 'glossy' && (
                                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/30 rounded-xl pointer-events-none" />
                              )}

                              {/* Staple simulation */}
                              {binding === 'staple' && isLast && (
                                <div className="absolute top-2.5 left-2.5 w-6 h-1.5 bg-slate-300 dark:bg-slate-400 border border-slate-400/80 -rotate-45 rounded-xs shadow-xs z-10" />
                              )}

                              {/* File sleeve simulation */}
                              {binding === 'file' && isLast && (
                                <div className="absolute inset-0 bg-sky-200/20 dark:bg-sky-400/10 border-2 border-sky-400/40 rounded-xl z-20 pointer-events-none shadow-inner" style={{ backdropFilter: 'blur(1px)' }}>
                                  <div className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full border border-sky-500/20 flex items-center justify-center bg-white/70 shadow-xs text-sky-650 font-bold text-[8px] animate-pulse">
                                    5₽
                                  </div>
                                </div>
                              )}

                              {/* Plastic/Metal Spiral simulation */}
                              {(binding === 'spring_plastic' || binding === 'spring_metal') && isLast && (
                                <div className="absolute top-0 bottom-0 left-1 w-2.5 flex flex-col justify-around items-center z-10">
                                  {Array.from({ length: 12 }).map((_, rIdx) => (
                                    <div 
                                      key={rIdx} 
                                      className={`w-3 h-1.5 rounded-full border ${
                                        binding === 'spring_plastic' 
                                          ? 'bg-slate-900 border-slate-800' 
                                          : 'bg-slate-200 border-slate-350 shadow-xs'
                                      }`} 
                                    />
                                  ))}
                                </div>
                              )}

                              {/* Hard cover simulation */}
                              {binding === 'hard_cover' && isLast && (
                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-xl flex flex-col justify-between p-4 shadow-xl text-slate-100 border border-slate-750">
                                  <div className="border border-slate-705 p-1 bg-slate-800/40 rounded-lg text-center text-[9px] font-bold uppercase tracking-widest mt-1.5">
                                    Твердый переплет
                                  </div>
                                  <div className="space-y-1 my-auto">
                                    <div className="h-1 bg-slate-500/30 rounded-full w-3/4 mx-auto" />
                                    <div className="h-1 bg-slate-505/30 rounded-full w-1/2 mx-auto" />
                                  </div>
                                  <div className="text-[8px] text-center text-slate-400 font-mono tracking-wider font-extrabold pb-1">
                                    * ПРЕМИУМ КОРЕШОК *
                                  </div>
                                </div>
                              )}

                              {/* Front cover layout components */}
                              {isLast && binding !== 'hard_cover' && (
                                <div className="w-full h-full flex flex-col justify-between pointer-events-none relative">
                                  {uploadedFiles[0] && (uploadedFiles[0].previewUrl || (uploadedFiles[0].formatGroup === 'image' && uploadedFiles[0].url)) ? (
                                    // True Uploaded Image Preview
                                    <div className="absolute inset-0 p-1 flex flex-col justify-between bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                                      <div className="w-full h-[82%] relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                                        <img 
                                          src={uploadedFiles[0].previewUrl || uploadedFiles[0].url} 
                                          className="w-full h-full object-cover" 
                                          alt={uploadedFiles[0].name}
                                          referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute top-1 right-1 bg-indigo-650/85 text-white text-[6px] font-black tracking-widest px-1 py-0.5 rounded-sm">
                                          ПЕЧАТЬ ИЗОБРАЖЕНИЯ
                                        </div>
                                      </div>
                                      <div className="flex justify-between items-center text-[6px] font-bold text-slate-500 font-mono px-0.5">
                                        <span className="truncate max-w-[110px]">{uploadedFiles[0].name}</span>
                                        <span>{formatFileSize(uploadedFiles[0].size)}</span>
                                      </div>
                                    </div>
                                  ) : uploadedFiles[0] ? (
                                    // Real Uploaded Document Preview Layout
                                    <div className="w-full h-full flex flex-col justify-between">
                                      <div className="flex justify-between items-center text-[7px] font-mono text-indigo-650 dark:text-indigo-400 font-bold uppercase tracking-wider">
                                        <span>{paperType === 'standard_a3' || paperType === 'bw_a3' ? 'A3 FORMAT' : 'A4 FORMAT'}</span>
                                        <span>PDF/DOCX</span>
                                      </div>
                                      
                                      <div className="my-auto py-2.5 flex flex-col items-center justify-center space-y-1 bg-slate-50/70 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-150 dark:border-slate-800">
                                        <FileText className="w-6 h-6 text-indigo-500" />
                                        <span className="text-[7.5px] font-black text-slate-805 dark:text-slate-100 text-center truncate w-full max-w-[130px]">
                                          {uploadedFiles[0].name}
                                        </span>
                                        <span className="text-[6.5px] font-mono text-slate-450 dark:text-slate-500">
                                          {formatFileSize(uploadedFiles[0].size)}
                                        </span>
                                      </div>

                                      <div className="flex justify-between items-end border-t border-slate-250/50 dark:border-slate-800/50 pt-1 text-[6.5px] font-mono text-slate-450">
                                        <span>Тираж: {copies} шт</span>
                                        <span>{paperDensity === 'thick' ? '160г' : '80г'}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    // Fallback standard render
                                    <>
                                      <div className="flex justify-between items-center text-[7px] font-mono text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">
                                        <span>{paperType === 'standard_a3' || paperType === 'bw_a3' ? 'A3 FORMAT' : 'A4 FORMAT'}</span>
                                        <span>{uploadedFiles.length} doc(s)</span>
                                      </div>

                                      <div className="my-auto py-4 flex flex-col items-center justify-center space-y-1">
                                        {printColor === 'bw' ? (
                                          <div className="w-14 h-14 bg-slate-50 dark:bg-slate-905 rounded-xl border border-slate-200/90 flex flex-col items-center justify-center p-2">
                                            <div className="w-full h-1.5 bg-slate-300 dark:bg-slate-600 rounded-xs mb-1" />
                                            <div className="w-5/6 h-1 bg-slate-300 dark:bg-slate-700 rounded-xs mb-1" />
                                            <div className="w-full h-1 bg-slate-350 dark:bg-slate-700 rounded-sub mb-2" />
                                            <div className="w-8 h-8 rounded-full border-4 border-slate-300 flex items-center justify-center text-[7px] font-black text-slate-405">
                                              Ч/Б
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="w-14 h-14 bg-gradient-to-tr from-amber-400 via-rose-455 to-indigo-500 rounded-xl flex flex-col items-center justify-center p-1.5 text-white shadow-sm ring-1 ring-white/10 animate-pulse">
                                            <div className="w-full h-1 bg-white/40 rounded-xs mb-1" />
                                            <div className="w-5/6 h-0.5 bg-white/20 rounded-xs mb-1" />
                                            <span className="text-[7.5px] font-black uppercase tracking-widest text-center text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
                                              {printColor === 'color_full' ? '100% ЦВЕТ' : 'ЦВЕТНОЙ'}
                                            </span>
                                          </div>
                                        )}

                                        <div className="text-[7.5px] font-semibold text-slate-400 dark:text-slate-500 tracking-wide pt-1">
                                          Приоритет: {paperDensity === 'thick' ? 'Плотный 160г' : 'Обычный 80г'}
                                        </div>
                                      </div>

                                      <div className="flex justify-between items-end border-t border-slate-200/50 dark:border-slate-800/50 pt-1.5">
                                        <div className="text-left leading-none">
                                          <span className="text-[7px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wider">Тираж:</span>
                                          <span className="text-[10px] font-extrabold text-slate-800 dark:text-white leading-none">{copies} шт</span>
                                        </div>
                                        <div className="text-right leading-none">
                                          <span className="text-[7px] text-slate-400 dark:text-slate-500 block uppercase font-bold tracking-wider font-mono">МАТЕРИАЛ</span>
                                          <span className="text-[8px] font-extrabold font-mono text-indigo-650 dark:text-indigo-400 leading-none">
                                            {paperType === 'standard' ? 'ОФИСНЫЙ' : paperType === 'kraft' ? 'КРАФТ' : 'ФОТО'}
                                          </span>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Visual details summary list under mockup wrapper */}
                    <div className="grid grid-cols-2 gap-2 text-[10.5px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/35 p-3 rounded-2xl border border-slate-150/50 dark:border-slate-850/30">
                      <div>
                        <strong>Формат:</strong> {paperType === 'standard_a3' || paperType === 'bw_a3' ? 'А3 (Большой)' : 'А4 (Стандарт)'}
                      </div>
                      <div>
                        <strong>Плотность:</strong> {paperDensity === 'thick' ? '160 г/м² (Плотная)' : '80 г/м² (Стандартная)'}
                      </div>
                      <div>
                        <strong>Покрытие:</strong> {paperType === 'glossy' ? 'Глянцевая' : paperType === 'matte' ? 'Матовая' : paperType === 'kraft' ? 'Крафтовая' : 'Обычное'}
                      </div>
                      <div>
                        <strong>Отделка:</strong> {binding === 'none' ? 'Без скрепления' : binding === 'staple' ? 'Степлер (угол)' : binding === 'file' ? 'Файлик' : binding === 'spring_metal' ? 'Металлическая пружина' : binding === 'spring_plastic' ? 'Пластиковая пружина' : 'Твёрдый переплет'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Printing Properties Form */}
              <div className="lg:col-span-5 glass-cozy-card p-6 md:p-8 rounded-[32px] space-y-6">
                <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-3">
                  <div className="icon-3d-badge p-2 bg-indigo-50 dark:bg-indigo-950/40">
                    <Sliders className="w-4 h-4 text-indigo-600 icon-3d-svg" />
                  </div>
                  <span>Шаг 2. Настройки печати</span>
                </h3>

                <form onSubmit={handlePlaceOrder} className="space-y-5">
                  {/* Quick Preset Short-cuts */}
                  <div className="space-y-2.5 pb-2 border-b border-slate-100 dark:border-slate-850">
                    <label className="block text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                      <span>Панель быстрых услуг (Пресеты)</span>
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          name: '📄 Ч/Б Документ',
                          desc: 'Ч/Б А4, стандарт 80г',
                          active: paperType === 'standard' && printColor === 'bw' && paperDensity === 'regular',
                          config: () => {
                            setPaperType('standard');
                            setPrintColor('bw');
                            setPaperDensity('regular');
                          }
                        },
                        {
                          name: '🎨 Цветной Лист',
                          desc: 'Цвет А4, стандарт 80г',
                          active: paperType === 'standard' && printColor === 'color' && paperDensity === 'regular',
                          config: () => {
                            setPaperType('standard');
                            setPrintColor('color');
                            setPaperDensity('regular');
                          }
                        },
                        {
                          name: '📐 Чертеж А3',
                          desc: 'Большой лист, Ч/Б',
                          active: paperType === 'standard_a3' && printColor === 'bw',
                          config: () => {
                            setPaperType('standard_a3');
                            setPrintColor('bw');
                          }
                        }
                      ].map((preset, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            preset.config();
                            playPlaceOrderSound();
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all duration-250 hover:scale-[1.02] cursor-pointer flex flex-col justify-between ${
                            preset.active
                              ? 'border-blue-600 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/20 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <span className={`${preset.active ? 'text-blue-700 dark:text-blue-400 font-extrabold' : 'text-slate-700 dark:text-slate-300 font-semibold'} text-xs block truncate`}>
                            {preset.name}
                          </span>
                          <span className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5 block truncate">
                            {preset.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Print Color Option (Печать документов) */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center justify-between">
                      <span>Выберите цветность (Обычная бумага):</span>
                      {paperType === 'standard' && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/50">
                          <Check className="w-3 h-3" /> Выбрано
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPrintColor('bw');
                          setPaperType('standard');
                        }}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center border font-bold text-xs transition-all cursor-pointer ${
                          paperType === 'standard' && printColor === 'bw'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-750 dark:text-indigo-400 font-extrabold ring-2 ring-indigo-500/20 scale-[1.02] shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className="text-xs font-black">Ч/Б печать</span>
                        <span className="text-[10px] font-medium text-slate-450 mt-1">
                          20 руб / стр
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPrintColor('color');
                          setPaperType('standard');
                        }}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center border font-bold text-xs transition-all cursor-pointer ${
                          paperType === 'standard' && printColor === 'color'
                            ? 'border-indigo-600 bg-[#e0f2fe]/40 dark:bg-indigo-950/20 text-[#0369a1] dark:text-indigo-400 font-extrabold ring-2 ring-[#0369a1]/20 scale-[1.02] shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className="text-xs font-black">Цветная печать</span>
                        <span className="text-[10px] font-medium text-[#0369a1] dark:text-indigo-300 mt-1">
                          от 25 руб / стр
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPrintColor('color_full');
                          setPaperType('standard');
                        }}
                        className={`py-3 px-2 rounded-2xl flex flex-col items-center justify-center border font-bold text-xs transition-all cursor-pointer ${
                          paperType === 'standard' && printColor === 'color_full'
                            ? 'border-indigo-600 bg-[#e0f2fe]/40 dark:bg-indigo-950/20 text-[#0369a1] dark:text-indigo-400 font-extrabold ring-2 ring-[#0369a1]/20 scale-[1.02] shadow-sm'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <span className="text-xs font-black truncate max-w-full">Ц/В картинки</span>
                        <span className="text-[10px] font-medium text-amber-600 mt-1">
                          от 65 руб / стр
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Photo Paper Selection Section */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center justify-between">
                      <span>Фотопечать на фотобумаге</span>
                      {(paperType === 'matte' || paperType === 'glossy') && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/50">
                          <Check className="w-3 h-3" /> Выбрано
                        </span>
                      )}
                    </label>
                    
                    {/* Choose between Matte and Glossy */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPaperType('matte');
                        }}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-center min-h-[64px] ${
                          paperType === 'matte'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-bold scale-[1.02] shadow-sm ring-2 ring-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">Матовая фотобумага</div>
                        <div className="text-[9px] text-slate-400 mt-1">Без отпечатков пальцев</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaperType('glossy');
                        }}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-center min-h-[64px] ${
                          paperType === 'glossy'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-bold scale-[1.02] shadow-sm ring-2 ring-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">Глянцевая фотобумага</div>
                        <div className="text-[9px] text-slate-400 mt-1">Яркие насыщенные цвета</div>
                      </button>
                    </div>

                    {/* Sizes Selection (visible and interactive when photo paper is selected) */}
                    {(paperType === 'glossy' || paperType === 'matte') && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/35 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2 mt-2 animate-fade-in">
                        <div className="text-[10px] font-black text-slate-405 dark:text-slate-500 uppercase tracking-widest text-center mb-1">
                          Выберите размер фотографии:
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {[
                            { id: '10*15', label: '10*15', price: '20 руб' },
                            { id: '13*18', label: '13*18', price: '50 руб' },
                            { id: '15*20', label: '15*20', price: '70 руб' },
                            { id: '20*30', label: '20*30', price: '100 руб' }
                          ].map(sizeOpt => (
                            <button
                              key={sizeOpt.id}
                              type="button"
                              onClick={() => setPhotoSize(sizeOpt.id as any)}
                              className={`py-2 px-1 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer flex flex-col items-center justify-center ${
                                photoSize === sizeOpt.id
                                  ? 'border-indigo-600 bg-indigo-50/55 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 font-black'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 text-slate-600 dark:text-slate-400 hover:border-slate-305'
                              }`}
                            >
                              <span className="text-[11px] font-bold">{sizeOpt.label}</span>
                              <span className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">{sizeOpt.price}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Format A3 Section */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center justify-between">
                      <span>Формат А3</span>
                      {(paperType === 'standard_a3' || paperType === 'bw_a3') && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200/50">
                          <Check className="w-3 h-3" /> Выбрано
                        </span>
                      )}
                    </label>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPaperType('standard_a3');
                        }}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-center min-h-[72px] ${
                          paperType === 'standard_a3'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-bold scale-[1.02] shadow-sm ring-2 ring-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">Обычная бумага А3</div>
                        <div className="text-[9px] text-slate-405 mt-1">Текст / Чертежи</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPaperType('bw_a3');
                        }}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-center min-h-[72px] ${
                          paperType === 'bw_a3'
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-bold scale-[1.02] shadow-sm ring-2 ring-indigo-500/10'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-650 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">Фотобумага А3</div>
                        <div className="text-[9px] text-slate-405 mt-1">фотография</div>
                      </button>
                    </div>

                    {/* Choice of color/black-and-white for A3 (only visible when A3 options are chosen) */}
                    {(paperType === 'standard_a3' || paperType === 'bw_a3') && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/35 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-2 mt-2 animate-fade-in">
                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest text-center mb-1">
                          Цвет печати А3:
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setPrintColor('bw')}
                            className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                              printColor === 'bw'
                                ? 'border-indigo-600 bg-indigo-50/55 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-black'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            Черно-белая (Ч/Б)
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrintColor('color')}
                            className={`py-2 px-3 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                              printColor === 'color' || printColor === 'color_full'
                                ? 'border-indigo-600 bg-indigo-50/55 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-black'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                            }`}
                          >
                            Цветная (Ц/В)
                          </button>
                        </div>
                        <div className="text-[9px] text-center text-slate-500 font-bold pt-1">
                          Текущий тариф для А3: {paperType === 'standard_a3' ? (printColor === 'bw' ? '100 ₽ / стр' : '150 ₽ / стр') : (printColor === 'bw' ? '200 ₽ / стр' : '250 ₽ / стр')}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Copies count counter */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Количество полных копий
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                        className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold flex items-center justify-center text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={copies}
                        onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 h-11 border border-slate-200 dark:border-slate-800 rounded-xl text-center font-bold bg-white dark:bg-slate-950 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCopies(prev => prev + 1)}
                        className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold flex items-center justify-center text-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Finishing (Binding) Options */}
                  <div className="space-y-3 pt-1">
                    <label className="block text-xs font-bold text-slate-400 dark:text-slate-550 uppercase tracking-wider flex items-center justify-between">
                      <span>Финишная отделка (Скрепление)</span>
                      {binding !== 'none' && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-indigo-200/50">
                          <Check className="w-3 h-3" /> Выбрано
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 border-b border-slate-100 dark:border-slate-850 pb-4">
                      {(() => {
                        const totalUploadedPages = uploadedFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0);
                        const metalSpringPriceText = totalUploadedPages > 0 
                          ? `+${totalUploadedPages <= 100 ? 250 : 350} ₽` 
                          : '+250 / 350 ₽';
                        
                        return [
                          { id: 'none', label: 'Нет', desc: 'Просто листы', price: '0 ₽' },
                          { id: 'staple', label: 'Сшивка', desc: 'Скрепка в углу', price: '+15 ₽' },
                          { id: 'file', label: 'Файлик', desc: 'Прозрачный файл 5 ₽', price: '+5 ₽' },
                          { id: 'spring_metal', label: 'Металл. пружина', desc: 'До 100 листов 250₽ / выше 350₽', price: metalSpringPriceText },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setBinding(opt.id as any);
                              playPlaceOrderSound();
                            }}
                            className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                              binding === opt.id
                                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-750 dark:text-indigo-400 font-bold scale-[1.02] ring-2 ring-indigo-500/10 shadow-sm'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 hover:border-slate-300 opacity-80 hover:opacity-100'
                            }`}
                          >
                            <div className="text-[11px] font-bold leading-none">{opt.label}</div>
                            <div className="text-[8.5px] text-slate-400 mt-1 truncate leading-tight">{opt.desc}</div>
                            <div className="text-[9.5px] font-extrabold text-amber-600 dark:text-amber-400 mt-1 leading-none">{opt.price}</div>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Promo Code Input section */}
                  <div className="space-y-2 border-b border-slate-100 dark:border-slate-850 pb-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Промокод на скидку
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={promoCode}
                          onChange={e => setPromoCode(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleApplyPromo();
                            }
                          }}
                          placeholder="Например: WELCOME5, STUDENT15, PROMO10..."
                          disabled={!!appliedPromo}
                          className={`block w-full p-2.5 pr-20 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs font-bold uppercase transition-all ${
                            appliedPromo ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-500 text-emerald-600 dark:text-emerald-400' : ''
                          }`}
                        />
                        {appliedPromo && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-emerald-600 bg-emerald-100/50 px-2 py-0.5 rounded-md">
                            АКТИВЕН
                          </span>
                        )}
                      </div>
                      
                      {!appliedPromo ? (
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl cursor-pointer shadow-md shadow-indigo-600/10"
                        >
                          Применить
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-heavy text-xs rounded-xl cursor-pointer shadow-md"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                    {promoError && (
                      <p className="text-[10px] text-rose-500 font-bold dark:text-rose-400 animate-pulse">{promoError}</p>
                    )}
                    {appliedPromo && (
                      <p className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400">
                        Скидка успешно применена при расчете к сумме заказа!
                      </p>
                    )}
                  </div>

                  {/* Operator Notes/Priorities */}
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Заметки оператору печати (опционально)
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Например: Двухсторонняя печать, скрепка в углу, первая страница обложка..."
                      rows={3}
                      className="block w-full p-3.5 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-xs"
                    />
                  </div>

                  {/* Real-time calculated Cost Breakdown (Retro thermal receipt ticket style) */}
                  {uploadedFiles.length > 0 && (
                    <div className="relative overflow-hidden bg-[#faf9f5] dark:bg-slate-950/40 border border-slate-250 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-md transition-all duration-300">
                      {/* Left-right ticket punch-hole notches */}
                      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-900 rounded-full border border-slate-250 dark:border-slate-800 z-10"></div>
                      <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 bg-white dark:bg-slate-900 rounded-full border border-slate-250 dark:border-slate-800 z-10"></div>

                      <div className="text-center font-mono text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">
                        * РАСЧЕТ СТОИМОСТИ ЗАКАЗА *
                      </div>

                      <div className="space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between items-center text-slate-650 dark:text-slate-400">
                          <span>Загружено файлов:</span>
                          <span className="font-bold text-slate-800 dark:text-white">{uploadedFiles.length} шт.</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-slate-650 dark:text-slate-400">
                          <span>Всего страниц:</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {uploadedFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0)} стр.
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-650 dark:text-slate-400">
                          <span>Тираж (копии):</span>
                          <span className="font-bold text-slate-800 dark:text-white">x {copies}</span>
                        </div>

                        <div className="flex justify-between items-center text-slate-650 dark:text-slate-400">
                          <span>Тип бумаги:</span>
                          <span className="font-bold text-slate-800 dark:text-white truncate max-w-[160px]">
                            {paperType === 'standard' ? 'А4 Стандарт' : paperType === 'standard_a3' ? 'А3 Стандарт' : paperType === 'bw_a3' ? 'А3 Фотобумага' : paperType === 'matte' ? 'А4 Матовая' : 'А4 Глянцевая'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-650 dark:text-slate-400">
                          <span>Цветность:</span>
                          <span className="font-bold text-slate-800 dark:text-white">
                            {printColor === 'bw' ? 'Ч/Б (Монохром)' : printColor === 'color_full' ? 'Цвет (100% залит.)' : 'Цвет (RGB)'}
                          </span>
                        </div>

                        {paperDensity === 'thick' && paperType === 'standard' && (
                          <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-450 font-bold text-[11px]">
                            <span>Плотная бумага (160г/м²):</span>
                            <span>+10 ₽ / стр</span>
                          </div>
                        )}

                        {binding === 'none' ? (
                          <div className="flex justify-between items-center text-slate-500 dark:text-slate-500 text-[11px]">
                            <span>Скрепление / Отделка:</span>
                            <span className="font-medium">Нет (по прайсу)</span>
                          </div>
                        ) : (
                          (() => {
                            const totalPages = uploadedFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0);
                            let bindingFee = 0;
                            let label = '';
                            if (binding === 'staple') {
                              bindingFee = 15;
                              label = 'Скрепка';
                            } else if (binding === 'file') {
                              bindingFee = 5;
                              label = 'Файлик';
                            } else if (binding === 'spring_metal') {
                              bindingFee = totalPages <= 100 ? 250 : 350;
                              label = 'Металл. пружина';
                            } else if (binding === 'spring_plastic') {
                              bindingFee = 100;
                              label = 'Пластик. пружина';
                            } else {
                              bindingFee = 450;
                              label = 'Тв. переплет';
                            }
                            return (
                              <div className="flex justify-between items-center text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
                                <span>Комплектация ({label}):</span>
                                <span>+{bindingFee} ₽</span>
                              </div>
                            );
                          })()
                        )}

                        {(() => {
                          const activePromo = getActivePromo();
                          if (!activePromo) return null;
                          const originalCost = calculateOrderCost(
                            uploadedFiles.length,
                            copies,
                            paperType,
                            printColor,
                            (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity,
                            uploadedFiles,
                            (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
                            binding
                          );
                          const discountedCost = calculateOrderCost(
                            uploadedFiles.length,
                            copies,
                            paperType,
                            printColor,
                            (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity,
                            uploadedFiles,
                            (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
                            binding,
                            activePromo || undefined,
                            activePromo ? getActiveDiscountPercent(activePromo) : undefined
                          );
                          const savings = originalCost - discountedCost;
                          const discountPctText = activePromo === 'PROMO10' ? '-10%' : 
                                                 activePromo === 'STUDENT15' ? '-15%' : 
                                                 activePromo === 'FIRSTFREE' ? '-20%' :
                                                 activePromo === 'COPYMAX' ? '-50%' :
                                                 (user.promoCode && activePromo === user.promoCode.trim().toUpperCase()) ? `-${user.promoDiscount}%` : 
                                                 `-${getActiveDiscountPercent(activePromo)}%`;
                          return (
                            <>
                              <div className="flex justify-between items-center text-rose-600 dark:text-rose-450 font-bold text-[11px]">
                                <span>Промокод ({activePromo}):</span>
                                <span>{discountPctText}</span>
                              </div>
                              {savings > 0 && (
                                <div className="flex justify-between items-center text-rose-650 dark:text-rose-400 font-extrabold text-[11px]">
                                  <span>Размер скидки:</span>
                                  <span className="font-mono">-₽{savings}</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>

                      {/* Interactive serrated tear line */}
                      <div className="relative h-4 my-2">
                        <div className="absolute inset-x-0 top-1/2 h-[1px] border-t border-dashed border-slate-300 dark:border-slate-800 -translate-y-1/2"></div>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#faf9f5] dark:bg-slate-950 px-2 text-slate-400 dark:text-slate-500 text-[9px] font-mono font-bold flex items-center gap-1 select-none">
                          <span>✂️</span> <span className="tracking-widest uppercase text-[8px] opacity-80">ЛИНИЯ ОТРЫВА ЧЕКА</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-end font-mono">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-550 block">ИТОГ К ОПЛАТЕ:</span>
                          <span className="text-[8px] text-indigo-650 dark:text-indigo-400 font-semibold uppercase block leading-tight mt-0.5">
                            {(() => {
                              const activePromo = getActivePromo();
                              if (activePromo) {
                                const originalCost = calculateOrderCost(
                                  uploadedFiles.length,
                                  copies,
                                  paperType,
                                  printColor,
                                  (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity,
                                  uploadedFiles,
                                  (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
                                  binding
                                );
                                const discountedCost = calculateOrderCost(
                                  uploadedFiles.length,
                                  copies,
                                  paperType,
                                  printColor,
                                  (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity,
                                  uploadedFiles,
                                  (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
                                  binding,
                                  activePromo || undefined,
                                  activePromo ? getActiveDiscountPercent(activePromo) : undefined
                                );
                                const savings = originalCost - discountedCost;
                                return savings > 0 
                                  ? `Промокод применен (Сэкономлено ₽${savings})`
                                  : 'Промокод применен';
                              }
                              return 'Скидок не применено';
                            })()}
                          </span>
                        </div>
                        <span className="text-xl font-black text-slate-900 dark:text-indigo-400 leading-none">
                          ₽{(() => {
                            const activePromo = getActivePromo();
                            return calculateOrderCost(
                              uploadedFiles.length,
                              copies,
                              paperType,
                              printColor,
                              (paperType === 'glossy' || paperType === 'matte') ? photoSize : paperDensity,
                              uploadedFiles,
                              (paperType === 'glossy' || paperType === 'matte') ? photoSize : undefined,
                              binding,
                              activePromo || undefined,
                              activePromo ? getActiveDiscountPercent(activePromo) : undefined
                            );
                          })()}
                        </span>
                      </div>

                      {/* Real Barcode representation */}
                      <div className="pt-2 flex flex-col items-center justify-center space-y-1">
                        <div className="flex items-center justify-center gap-[1.5px] h-5 opacity-60 dark:opacity-30">
                          {[1,3,1,2,4,1,2,3,1,4,2,1,3,1,2,4,1,3,2,1,4,1,3,1].map((weight, i) => (
                            <div 
                              key={i} 
                              className="bg-slate-800 dark:bg-white h-full" 
                              style={{ width: `${weight * 0.75}px` }} 
                            />
                          ))}
                        </div>
                        <span className="text-[8px] font-mono tracking-widest text-slate-400 dark:text-slate-550">
                          * ORD-{1000 + database.orders.length + 1} *
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Create Order Submit */}
                  <button
                    type="submit"
                    disabled={uploadedFiles.length === 0 || !isWorkingHours()}
                    className={`w-full flex items-center justify-center gap-2 py-4 px-4 rounded-2xl font-black text-sm text-white transition-all shadow-lg ${
                      uploadedFiles.length > 0 && isWorkingHours()
                        ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10 cursor-pointer'
                        : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <FileCheck className="w-5 h-5" />
                    {!isWorkingHours() ? 'Оформление временно недоступно (Закрыто)' : 'Оформить заказ'}
                  </button>
                </form>
              </div>

              </motion.div>
            )}

            {/* TAB 2: ACTIVE AND HISTORIC ORDERS */}
            {activeTab === 'orders' && (
              <motion.div
                key="orders"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-6 w-full"
              >
              
              {/* Filter controls and top line */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-150 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex flex-wrap gap-1 w-full sm:w-auto">
                  {[
                    { id: 'all', label: 'Все заказы' },
                    { id: 'active', label: 'В процессе' },
                    { id: 'completed', label: 'Выданы' }
                  ].map(btn => (
                    <button
                      key={btn.id}
                      onClick={() => setOrderFilter(btn.id as any)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors w-full sm:w-auto ${
                        orderFilter === btn.id
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>


              </div>

              {/* Order Lists Rendering */}
              {userOrders.length === 0 ? (
                <div className="text-center bg-white dark:bg-slate-900 rounded-3xl p-12 border border-slate-150 dark:border-slate-800 max-w-lg mx-auto">
                  <div className="bg-slate-100 dark:bg-slate-950 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                    <FileCheck className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-slate-800 dark:text-white">У вас еще нет заказов</h4>
                  <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
                    Загружайте ваши учебные файлы, рефераты, фотографии или архивы чертежей на первом шаге и отправляйте их администратору.
                  </p>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className="mt-6 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl transition-all"
                  >
                    Начать загрузку
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {userOrders
                    .filter(ord => {
                      if (orderFilter === 'active') return ord.status !== 'printed';
                      if (orderFilter === 'completed') return ord.status === 'printed';
                      return true;
                    })
                    .map(ord => (
                      <div
                        key={ord.id}
                        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm overflow-hidden"
                      >
                        {/* Upper Section */}
                        <div className="p-5 border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 flex flex-col sm:flex-row justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black text-slate-800 dark:text-white uppercase">
                                {ord.id}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {formatDateTime(ord.orderDate)}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-450">
                              Файлов: <strong>{ord.files.length} шт.</strong> | {ord.copies} {ord.copies === 1 ? 'копия' : ord.copies < 5 ? 'копии' : 'копий'} &bull; Бумага: <strong>{ord.paperType.toUpperCase()}</strong> &bull; Цветность: <strong>{ord.printColor === 'bw' ? 'Черно-белая' : 'Цветная'}</strong>
                            </div>
                          </div>

                          {/* Order Status Badges indicators */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${getStatusColor(ord.status)}`}>
                              {getStatusLabel(ord.status)}
                            </span>
                            <span className={`text-[11px] font-bold px-3 py-1 rounded-full ${getPaymentStatusColor(ord.paymentStatus)}`}>
                              {getPaymentStatusLabel(ord.paymentStatus)}
                            </span>
                          </div>
                        </div>

                        {/* Mid Section - Files & Notes */}
                        <div className="p-5 space-y-4">
                          <div className="space-y-2">
                            <div className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Загруженный комплект:</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {ord.files.map(f => (
                                <div key={f.id} className="p-2.5 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-between gap-2.5 text-xs relative group">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <FileType className="w-4.5 h-4.5 text-indigo-505" />
                                    <div className="overflow-hidden">
                                      <span className="font-bold block truncate text-slate-700 dark:text-slate-350">{f.name}</span>
                                      <span className="text-[9px] text-slate-400 block">{formatFileSize(f.size)}</span>
                                    </div>
                                  </div>

                                  {canDeleteFileFromOrder(ord) && (
                                    <div className="shrink-0 flex items-center">
                                      {fileToConfirmDelete?.orderId === ord.id && fileToConfirmDelete?.fileId === f.id ? (
                                        <div className="flex items-center gap-1">
                                          <span className="text-[9px] font-black text-rose-500 uppercase mr-1 animate-pulse">Удалить?</span>
                                          <button
                                            onClick={() => handleDeleteFileFromOrder(ord.id, f.id)}
                                            className="bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                                          >
                                            Да
                                          </button>
                                          <button
                                            onClick={() => setFileToConfirmDelete(null)}
                                            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                                          >
                                            Нет
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setFileToConfirmDelete({ orderId: ord.id, fileId: f.id })}
                                          className="p-1 px-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-850 rounded transition cursor-pointer"
                                          title="Удалить файл из заказа"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {ord.notes && (
                            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl text-[11px] border border-slate-100 dark:border-slate-800">
                              <span className="font-bold text-slate-500 dark:text-slate-400">Требования к распечатке:</span> {ord.notes}
                            </div>
                          )}
                        </div>

                        {/* Bottom Actions Row */}
                        <div className="p-5 bg-slate-50/20 dark:bg-slate-950/10 border-t border-slate-150 dark:border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3">
                          <div className="flex items-baseline gap-1">
                            <span className="text-xs text-slate-400 font-bold">К оплате:</span>
                            <span className="text-md font-black text-slate-800 dark:text-white">₽{ord.totalCost}</span>
                          </div>

                          <div className="flex gap-2 w-full sm:w-auto">
                            {/* PDF Invoice Button */}
                            <button
                              onClick={() => printInvoiceHTML(ord)}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-white hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold px-3.5 py-2.5 rounded-xl transition"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Накладная
                            </button>

                            {/* Payment Integration Trigger */}
                            {ord.paymentStatus !== 'paid' ? (
                              <button
                                onClick={() => setPayingOrder(ord)}
                                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-4.5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/10 transition"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                Оплатить через Банк / СБП
                              </button>
                            ) : (
                              <span className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-500/20 px-4.5 py-2.5 rounded-xl text-xs font-bold">
                                <CheckCircle className="w-4 h-4" /> Оплачено ({ord.paymentMethod})
                              </span>
                            )}
                          </div>
                        </div>

                      </div>
                    ))}
                </div>
              )}

              </motion.div>
            )}

            {/* TAB 3: LIVE FEEDBACK INTEGRATED CHAT */}
            {activeTab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm flex flex-col h-[550px] overflow-hidden transition-all duration-300 w-full"
              >
              
              {/* Operator info header */}
              <div className="p-4 border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                      alt="Operator"
                      className="w-10 h-10 rounded-xl object-cover shrink-0 ring-2 ring-emerald-500/30"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-white">Дмитрий (Главный Печатник)</h4>
                    {isWorkingHours() ? (
                      <span className="text-[10px] text-emerald-600 font-bold dark:text-emerald-400 uppercase tracking-widest block mt-0.5 animate-pulse">● Копи-Центр Открыт (Печать Онлайн)</span>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold dark:text-rose-400 uppercase tracking-widest block mt-0.5">● Копи-Центр Закрыт (Вне Рабочее Время)</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href="tel:+79680508800"
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:text-white dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-xl transition-all shadow-sm shadow-emerald-600/10"
                    title="Связаться по телефону"
                  >
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    <span>Связаться</span>
                  </a>
                  
                  <div className="hidden lg:block text-slate-400 text-[10px] font-bold uppercase tracking-wider pl-2">
                    Шифрование SSL
                  </div>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/30 dark:bg-slate-950/10">
                {userChats.length === 0 ? (
                  <div className="h-full flex flex-col justify-center items-center text-center p-8">
                    <div className="bg-slate-100 dark:bg-slate-900 w-14 h-14 rounded-full flex items-center justify-center text-slate-400 mb-3">
                      <MessageSquare className="w-7 h-7" />
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-white">Чат пуст. Начните диалог первым!</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                      Вы можете уточнить статус заказа, согласовать перенос времени или заказать брошюровку у оператора в реальном времени.
                    </p>
                  </div>
                ) : (
                  userChats.map(msg => {
                    const isAdmin = msg.senderRole === 'admin';
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] ${isAdmin ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
                      >
                        {isAdmin ? (
                          <UserAvatar
                            fallbackText="Оператор"
                            className="w-8 h-8 rounded-lg shrink-0"
                          />
                        ) : (
                          <UserAvatar
                            user={user}
                            className="w-8 h-8 rounded-lg shrink-0 ring-2 ring-indigo-505/20 border border-white dark:border-slate-900"
                          />
                        )}
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-400 block px-1">
                            {msg.senderName} &bull; {new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div
                            className={`p-3.5 rounded-2xl text-xs leading-relaxed font-medium shadow-sm border ${
                              isAdmin
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-100 dark:border-slate-800 rounded-tl-none'
                                : 'bg-indigo-600 text-white border-transparent rounded-tr-none'
                            }`}
                          >
                            {msg.message.startsWith('[IMAGE]:') ? (
                              <div className="space-y-1 my-0.5">
                                <img
                                  src={msg.message.substring(8)}
                                  className="rounded-xl max-w-[200px] sm:max-w-xs cursor-pointer hover:opacity-90 shadow-sm border border-slate-200 dark:border-slate-800"
                                  alt="Пример готового продукта"
                                />
                                <span className="text-[9px] opacity-70 block italic">Защищено водяным знаком &bull; ПРИМЕР</span>
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

              {/* Chat inputs panel */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-150 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Задайте ваш вопрос Дмитрий..."
                  className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:dark:bg-slate-850 text-white py-3 px-4.5 rounded-xl font-bold text-xs flex items-center justify-center transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
              </motion.div>
            )}

            {/* TAB 4: USER CABINET & DEVICE SYNCHRONIZATION DATA */}
            {activeTab === 'profile' && (
              <motion.div
                key="profile"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="space-y-6 w-full"
              >
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* User Stats Card */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-6">
                  {isEditingProfile ? (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div className="text-center space-y-4">
                        {/* Live adjusted avatar preview */}
                        <div className="flex justify-center">
                          <UserAvatar
                            user={{
                              fullName: editFullName,
                              avatarUrl: editAvatarUrl,
                              avatarScale: editAvatarScale,
                              avatarX: editAvatarX,
                              avatarY: editAvatarY
                            }}
                            className="w-24 h-24 rounded-2xl ring-4 ring-indigo-500/15"
                          />
                        </div>

                        {/* Sliders for precise alignment */}
                        <div className="max-w-xs mx-auto bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-xl p-3 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-1.5">
                            <span className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 uppercase tracking-widest">Разметка и наклон лица</span>
                            <button
                              onClick={() => {
                                setEditAvatarScale(1);
                                setEditAvatarX(0);
                                setEditAvatarY(0);
                              }}
                              type="button"
                              className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 cursor-pointer uppercase transition-colors"
                            >
                              Сбросить
                            </button>
                          </div>

                          {/* Scale Slider */}
                          <div className="space-y-1 text-left">
                            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Масштаб (Приближение):</span>
                              <span className="font-mono text-indigo-500">{(editAvatarScale * 100).toFixed(0)}%</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="3"
                              step="0.02"
                              value={editAvatarScale}
                              onChange={(e) => setEditAvatarScale(parseFloat(e.target.value))}
                              className="w-full accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* X Offset Slider */}
                          <div className="space-y-1 text-left">
                            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Влево ↔ Вправо:</span>
                              <span className="font-mono text-indigo-500">{editAvatarX > 0 ? `+${editAvatarX}` : editAvatarX}px</span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={editAvatarX}
                              onChange={(e) => setEditAvatarX(parseInt(e.target.value))}
                              className="w-full accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>

                          {/* Y Offset Slider */}
                          <div className="space-y-1 text-left">
                            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Вверх ↕ Вниз:</span>
                              <span className="font-mono text-indigo-500">{editAvatarY > 0 ? `+${editAvatarY}` : editAvatarY}px</span>
                            </div>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={editAvatarY}
                              onChange={(e) => setEditAvatarY(parseInt(e.target.value))}
                              className="w-full accent-indigo-600 h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                        </div>

                        <span className="text-xs font-black uppercase tracking-wider text-slate-400 block mb-2">Выберите быстрый аватар:</span>
                        <div className="grid grid-cols-6 gap-2 mb-3 max-w-xs mx-auto">
                          {[
                            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80",
                            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
                            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=80",
                            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80",
                            "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop&q=80",
                            "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80"
                          ].map((urlPreset, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                setEditAvatarUrl(urlPreset);
                                // Reset offsets for presets
                                setEditAvatarScale(1);
                                setEditAvatarX(0);
                                setEditAvatarY(0);
                              }}
                              className={`w-10 h-10 rounded-xl object-cover overflow-hidden border-2 transition cursor-pointer ${
                                editAvatarUrl === urlPreset ? 'border-indigo-600 scale-105 shadow-md' : 'border-transparent hover:scale-102'
                              }`}
                            >
                              <img src={urlPreset} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </button>
                          ))}
                        </div>

                        <div className="space-y-1 text-left">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Или укажите свою ссылку на изображение:</label>
                          <input
                            type="text"
                            value={editAvatarUrl}
                            onChange={(e) => {
                              setEditAvatarUrl(e.target.value);
                              // Reset offsets for custom URL to keep initial layout clean
                              setEditAvatarScale(1);
                              setEditAvatarX(0);
                              setEditAvatarY(0);
                            }}
                            className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="https://example.com/avatar.jpg"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Ваше Имя и Фамилия:</label>
                          <input
                            type="text"
                            required
                            value={editFullName}
                            onChange={(e) => setEditFullName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                            placeholder="Иван Иванов"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Контактный телефон:</label>
                          <input
                            type="text"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-white border border-slate-200 dark:border-slate-850 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                            placeholder="+7 999 123-45-67"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingProfile(false);
                            setEditFullName(user.fullName);
                            setEditPhone(user.phone || '');
                            setEditAvatarUrl(user.avatarUrl || '');
                          }}
                          className="py-2 px-3 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition cursor-pointer"
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                        >
                          Сохранить
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="relative group text-center">
                        <div className="relative inline-block">
                          <div 
                            title="Кликните, чтобы загрузить новое фото"
                            onClick={() => avatarInputRef.current?.click()}
                            className="relative cursor-pointer group active:scale-95 transition-transform duration-150"
                          >
                            <UserAvatar
                              user={user}
                              className="w-20 h-20 rounded-2xl ring-4 ring-indigo-500/20 mx-auto mb-3 transition"
                            />
                            <div className="absolute inset-0 max-w-[80px] h-20 rounded-2xl bg-slate-950/70 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity duration-200 mx-auto mb-3">
                              <Upload className="w-4 h-4 text-indigo-250 mb-0.5" />
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-100">Фото</span>
                            </div>
                            {avatarUploading && (
                              <div className="absolute inset-0 max-w-[80px] h-20 rounded-2xl bg-[#0f172a]/85 flex items-center justify-center text-white mx-auto mb-3">
                                <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
                              </div>
                            )}
                          </div>
                          
                          <input 
                            type="file" 
                            ref={avatarInputRef} 
                            onChange={handleAvatarFileChange} 
                            accept="image/*" 
                            className="hidden" 
                          />

                          {/* Visual loyalty rank float indicator */}
                          <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-md ${
                            getClientTierForUser(user.id, database.orders).tierCode === 'vip' ? 'bg-amber-500 text-white' :
                            getClientTierForUser(user.id, database.orders).tierCode === 'loyal' ? 'bg-slate-300 text-slate-800' : 'bg-indigo-600 text-white'
                          }`}>
                            {getClientTierForUser(user.id, database.orders).tierCode === 'vip' ? <Sparkles className="w-4 h-4 text-emerald-100" /> :
                             getClientTierForUser(user.id, database.orders).tierCode === 'loyal' ? <Trophy className="w-4 h-4 text-emerald-100" /> : <Star className="w-4 h-4 text-emerald-100" />}
                          </div>
                        </div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white mt-1">{user.fullName}</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{user.role === 'admin' ? 'Администратор' : 'Клиент Копи-Центра'}</p>
                        
                        {/* Interactive dynamic loyalty badge */}
                        <div className="mt-2.5 flex justify-center">
                          <span className={getClientTierForUser(user.id, database.orders).badgeClass}>
                            {getClientTierForUser(user.id, database.orders).tierCode === 'vip' ? <Sparkles className="w-3 h-3 text-slate-950" /> :
                             getClientTierForUser(user.id, database.orders).tierCode === 'loyal' ? <Trophy className="w-3.5 h-3.5 text-amber-650" /> : <Star className="w-3 h-3 text-indigo-100" />}
                            {getClientTierForUser(user.id, database.orders).name}
                          </span>
                        </div>
                      </div>

                      {/* Dynamic Loyalty Goal Meter */}
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-850 space-y-2">
                        {(() => {
                          const paidTotal = userOrders.reduce((acc, current) => acc + (current.paymentStatus === 'paid' ? current.totalCost : 0), 0);
                          const tier = getClientTierForUser(user.id, database.orders);
                          let nextGoal = 5000;
                          let progress = (paidTotal / 5000) * 100;
                          let goalLabel = 'Постоянный клиент';
                          
                          if (paidTotal >= 50000) {
                            nextGoal = 50000;
                            progress = 100;
                            goalLabel = 'Максимальный VIP';
                          } else if (paidTotal >= 5000) {
                            nextGoal = 50000;
                            progress = ((paidTotal - 5000) / 45000) * 100;
                            goalLabel = 'VIP статус (Приоритет печати)';
                          }
                          
                          return (
                            <>
                              <div className="flex justify-between items-baseline text-[10px] font-bold">
                                <span className="text-slate-400 uppercase tracking-widest">Прогресс лояльности:</span>
                                <span className="text-slate-500 font-black">{paidTotal} ₽ / {nextGoal} ₽</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    tier.tierCode === 'vip' ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                                    tier.tierCode === 'loyal' ? 'bg-gradient-to-r from-indigo-500 to-amber-400' : 'bg-indigo-600'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(8, progress))}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] font-bold text-slate-400">
                                <span>{tier.name}</span>
                                {paidTotal < 50000 ? (
                                  <span className="text-indigo-600 dark:text-indigo-400">До статуса {goalLabel}: {(nextGoal - paidTotal).toLocaleString()} ₽</span>
                                ) : (
                                  <span className="text-amber-500 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Приоритетная VIP-печать включена</span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="border-t border-slate-150 dark:border-slate-800 pt-5 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Ваш Email:</span>
                          <span className="font-bold text-slate-805 dark:text-slate-300">{user.email}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Номер телефона:</span>
                          <span className="font-bold text-slate-805 dark:text-slate-300">{user.phone || '+7 (---) ----**-**'}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-[10px] text-slate-400">Дата регистрации:</span>
                          <span className="font-bold text-slate-805 dark:text-slate-300">{formatDateTime(user.createdAt)}</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Всего заказов:</span>
                          <span className="font-bold text-slate-805 dark:text-slate-300">{userOrders.length} шт.</span>
                        </div>

                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">Сумма трат:</span>
                          <span className="font-bold text-slate-855 dark:text-slate-300">₽{userOrders.reduce((acc, current) => acc + (current.paymentStatus === 'paid' ? current.totalCost : 0), 0)}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-3.5 border-t border-slate-150 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(true)}
                            className="py-2.5 px-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Sliders className="w-3.5 h-3.5" /> Изменить профиль
                          </button>
                          
                          <a
                            href="tel:+79680508800"
                            className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            Позвонить
                          </a>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Secure System & Synchronization Details */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-6">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Безопасность и Настройки</h3>
                  
                  <div className="space-y-4">
                    
                    {/* Device Sync State Panel */}
                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/30 dark:border-indigo-900/30 rounded-2xl flex items-start gap-3">
                      <RefreshCw className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5 animate-spin" />
                      <div>
                        <h4 className="font-bold text-xs text-slate-800 dark:text-white flex items-center gap-1.5">
                          Авто-синхронизания активна 
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                        </h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          Кабинет автоматически синхронизируется между вашими устройствами и вкладками браузера в реальном времени. Изменения на ПК моментально отобразятся на смартфоне.
                        </p>
                      </div>
                    </div>

                    {/* Social connection options */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl space-y-3 border border-slate-100 dark:border-slate-850">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Связанные соцсети</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                          user.isSocial 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
                            : 'bg-slate-100 border-slate-200 text-slate-550 dark:bg-slate-900 dark:text-slate-400'
                        }`}>
                          {user.isSocial ? 'Подключено через OAuth' : 'Локальный Email пароль'}
                        </span>
                      </div>
                    </div>

                    {/* Self Account deletion */}
                    <div className="p-4 border border-rose-100 dark:border-rose-950/40 rounded-2xl bg-rose-50/50 dark:bg-rose-950/10 space-y-3">
                      <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider block">Удаление профиля согласно GDPR</span>
                      <p className="text-[10px] text-rose-700/80 dark:text-rose-400/80">
                        Вы можете навсегда удалить все ваши учетные данные, загруженные файлы и историю из базы данных Копи-Центра.
                      </p>
                      <button
                        onClick={handleDeleteSelf}
                        className="py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded-lg transition"
                      >
                        Применить удаление данных
                      </button>
                    </div>
                  </div>
                </div>

                {/* Theme Customizer Card */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-650" />
                      <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Индивидуальный Стиль и Тема</h3>
                    </div>
                    
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                      Выберите эксклюзивное оформление для вашего кабинета. Все три варианта полностью совместимы с дневным и ночным режимами. Нажмите для мгновенного превью:
                    </p>

                    <div className="space-y-2.5 pt-1">
                      {/* Theme: Blue */}
                      <button
                        type="button"
                        onClick={() => setDesignTheme('blue')}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          designTheme === 'blue'
                            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shrink-0 shadow-inner font-extrabold text-[10px]">
                          🔵
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight">Бизнес-Портал (Синий)</h4>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase font-bold tracking-wider">Классический строгий интерфейс</p>
                        </div>
                        {designTheme === 'blue' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shrink-0" />
                        )}
                      </button>

                      {/* Theme: Kraft */}
                      <button
                        type="button"
                        onClick={() => setDesignTheme('kraft')}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          designTheme === 'kraft'
                            ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                            : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shrink-0 shadow-inner font-extrabold text-[10px]">
                          🌿
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight">Эко-Крафт / Уютная Типография (Зеленый)</h4>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase font-bold tracking-wider">Теплый кремовый фон и лесной изумруд</p>
                        </div>
                        {designTheme === 'kraft' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        )}
                      </button>

                      {/* Theme: Cyber */}
                      <button
                        type="button"
                        onClick={() => setDesignTheme('cyber')}
                        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          designTheme === 'cyber'
                            ? 'bg-purple-50/20 dark:bg-purple-950/20 border-purple-500 shadow-md ring-2 ring-purple-500/20'
                            : 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-600 to-purple-800 flex items-center justify-center text-white shrink-0 shadow-inner font-extrabold text-[10px]">
                          🔮
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white leading-tight">Киберпанк / Неоновый Космос (Фиолетовый)</h4>
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate uppercase font-bold tracking-wider">Глубокий темный и светящийся неон-нектар</p>
                        </div>
                        {designTheme === 'cyber' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                    <span>Текущий выбор:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-white text-[9px] font-black ${
                      designTheme === 'blue' ? 'bg-indigo-600' :
                      designTheme === 'kraft' ? 'bg-emerald-600' : 'bg-purple-600'
                    }`}>
                      {designTheme === 'blue' ? 'Pro Blue Active' :
                       designTheme === 'kraft' ? 'Nordic Kraft Active' : 'Cyber Midnight Active'}
                    </span>
                  </div>
                </div>

                {/* Social Share Referral Widget Card */}
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-3xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-5">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4.5 h-4.5 text-indigo-650" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Поделиться Сервисом</h3>
                  </div>
                  
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                    Порекомендуйте наш удобный онлайн Копи-Центр друзьям. Поделитесь ссылкой в один клик через WhatsApp, Telegram, VKontakte или Email.
                  </p>

                  <div className="grid grid-cols-4 gap-2.5">
                    {/* WhatsApp share */}
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent('Привет! Пользуюсь классным сайтом для онлайн заказа распечатки в Копи-Центре (А4, фото, чертежи, брошюровка). Загрузка файлов прямо с телефона. Попробуй сам: ' + window.location.origin)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3.5 px-1 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 hover:bg-emerald-50/20 dark:bg-slate-950/20 dark:hover:bg-emerald-950/20 hover:border-emerald-250 transition-all duration-200 group cursor-pointer"
                      title="Поделиться в WhatsApp"
                    >
                      <svg className="w-5 h-5 text-emerald-605 group-hover:scale-110 transition duration-200" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.717-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.42 9.864-9.843.002-2.628-1.022-5.1-2.885-6.964C16.588 1.94 14.116.916 11.5.914 6.066.914 1.644 5.334 1.64 10.758c-.001 1.71.455 3.38 1.321 4.843L1.87 21.08l5.88-1.543zm12.353-8.156c-.334-.167-1.971-.972-2.275-1.082-.303-.11-.525-.164-.746.168-.221.332-.856 1.082-1.05 1.302-.193.222-.387.247-.72.08-1.53-.762-2.658-1.32-3.714-3.13-.28-.48.28-.445.8-.1.353-.284.582-.44.825-.94.24-.5.12-.94-.03-1.272-.15-.332-1.272-3.07-1.742-4.2-.459-1.1-.92-1.05-1.272-1.055-.3-.004-.643-.004-.985-.004-.34 0-.895.127-1.36.64-.462.513-1.766 1.727-1.766 4.21s1.807 4.88 2.057 5.214C8.42 16.52 11.92 21.5 17.5 23.513c3.27 1.18 4.254 1.139 5.332.96 1.05-.17 2.275-.928 2.595-1.785.32-.857.32-1.593.224-1.785-.096-.192-.352-.303-.687-.47z" />
                      </svg>
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">WhatsApp</span>
                    </a>

                    {/* Telegram share */}
                    <a
                      href={`https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encodeURIComponent('Привет! Рекомендую этот онлайн-сервис заказа быстрой распечатки документов и фотографий. Файлы можно слать прямо с телефона!')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3.5 px-1 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 hover:bg-sky-50/20 dark:bg-slate-950/20 dark:hover:bg-sky-950/20 hover:border-sky-250 transition-all duration-200 group cursor-pointer"
                      title="Поделиться в Telegram"
                    >
                      <svg className="w-5 h-5 text-sky-500 group-hover:scale-110 transition duration-200" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-1-.65-.35-1 .22-1.6 1.5-1.55 2.75-2.91 3.75-3.95.44-.45.89-.96.44-.96-.45 0-1.18.3-2.18.97-1 .68-1.86 1.25-3.5 2.33-.53.35-.95.53-1.34.52-.42 0-1.22-.23-1.82-.42-.74-.24-1.33-.36-1.28-.77.03-.21.32-.43.88-.67 3.44-1.5 5.74-2.49 6.89-2.98 3.29-1.37 3.98-1.61 4.43-1.62.1 0 .32.02.46.14.12.1.15.24.17.34.02.13.02.43 0 .52z" />
                      </svg>
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">Telegram</span>
                    </a>

                    {/* VK share - corrected custom vector icon & color path */}
                    <a
                      href={`https://vk.com/share.php?url=${encodeURIComponent(window.location.origin)}&title=${encodeURIComponent('Копи-Центр ОНЛАЙН')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center justify-center py-3.5 px-1 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 hover:bg-blue-50/20 dark:bg-slate-950/20 dark:hover:bg-blue-950/20 hover:border-blue-250 transition-all duration-200 group cursor-pointer"
                      title="Поделиться во ВКонтакте"
                    >
                      <svg className="w-5 h-5 text-[#0077FF] dark:text-[#3f94ff] group-hover:scale-110 transition duration-200" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.024 19.141c-5.748 0-10.354-4.57-10.457-11.141H7.5c.071 4.795 2.203 6.829 3.882 7.247V8h2.824v4.132c1.729-.184 3.473-2.073 4.086-4.132h2.824a10.22 10.22 0 01-3.765 5.518c1.376.623 3.153 2.296 4.141 5.623h-3.035c-.776-2.39-2.706-4.247-4.259-4.39V19.14h-.012z"/>
                      </svg>
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">ВКонтакте</span>
                    </a>

                    {/* Email share */}
                    <a
                      href={`mailto:?subject=${encodeURIComponent('Онлайн Копи-Центр ОНЛАЙН')}&body=${encodeURIComponent('Привет! Стал заказывать распечатку документов и фотографий онлайн с доставкой/брошюровкой на этом сайте. Рекомендую и тебе: ' + window.location.origin)}`}
                      className="flex flex-col items-center justify-center py-3.5 px-1 rounded-2xl border border-slate-100 dark:border-slate-850 bg-slate-50/30 hover:bg-indigo-50/20 dark:bg-slate-950/20 dark:hover:bg-indigo-950/20 hover:border-indigo-250 transition-all duration-200 group cursor-pointer"
                      title="Отправить по Email"
                    >
                      <Mail className="w-5 h-5 text-indigo-650 group-hover:scale-110 transition duration-200" />
                      <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-1.5">Email</span>
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(window.location.origin);
                        setShareCopied(true);
                        setTimeout(() => setShareCopied(false), 2000);
                      } catch (err) {
                        // Silent recovery
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-slate-250 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950/50 hover:text-slate-900 dark:hover:text-white font-bold text-xs rounded-xl transition duration-200 cursor-pointer"
                  >
                    {shareCopied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500 animate-bounce" />
                        <span className="text-emerald-500">Ссылка скопирована!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-450" />
                        <span>Скопировать ссылку сайта для отправки</span>
                      </>
                    )}
                  </button>
                </div>

              </div>

              {/* In App Notifications Journal */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 border border-slate-150 dark:border-slate-800">
                <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-150 dark:border-slate-800">
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Bell className="w-4.5 h-4.5 text-indigo-650" /> Журнал уведомлений
                  </h3>
                  <button
                    onClick={handleMarkNotificationsRead}
                    className="text-xs text-indigo-600 hover:text-indigo-500 font-bold"
                  >
                    Пометить всё как прочитанное
                  </button>
                </div>

                {userNotifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Журнал уведомлений пуст. Все статусы в порядке!</p>
                ) : (
                  <div className="space-y-3.5 max-h-72 overflow-y-auto">
                    {userNotifications.map(notif => (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-2xl border flex items-start gap-3 transition ${
                          notif.read 
                            ? 'bg-slate-50/50 dark:bg-slate-950/10 border-slate-100 dark:border-slate-850 opacity-60' 
                            : 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-100/30'
                        }`}
                      >
                        <div className="bg-white dark:bg-slate-950 p-2 rounded-xl text-indigo-605 shadow-sm">
                          <Bell className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{notif.title}</h4>
                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-1">{new Date(notif.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{notif.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </main>

      {/* File Preview Modal */}
      {previewFile && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setPreviewFile(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/30">
              <div className="overflow-hidden mr-2">
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider truncate">
                  Предпросмотр: {previewFile.name}
                </h3>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                  Размер: {formatFileSize(previewFile.size)} &bull; Формат: {previewFile.formatGroup.toUpperCase()}
                </span>
              </div>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-205 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white text-lg font-black transition-colors cursor-pointer shrink-0"
              >
                &times;
              </button>
            </div>

            {/* Content area */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950/20 min-h-[260px]">
              {previewFile.type.startsWith('image/') || previewFile.formatGroup === 'image' ? (
                <img
                  src={previewFile.previewUrl || previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[50vh] object-contain rounded-xl shadow-md border border-slate-200/50 dark:border-slate-850"
                  referrerPolicy="no-referrer"
                />
              ) : previewFile.type === 'application/pdf' || previewFile.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewFile.previewUrl || previewFile.url}
                  title={previewFile.name}
                  className="w-full h-[50vh] rounded-xl border border-slate-200/50 dark:border-slate-850 bg-white"
                />
              ) : (
                <div className="text-center p-8 max-w-md">
                  <div className="text-slate-400 dark:text-slate-500 text-4xl mb-3">📄</div>
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Прямой предпросмотр для этого формата недоступен.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                    Но вы можете отправить его на печать! Мы поддерживаем чертежи, текстовые документы и архивы.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-150 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-950/30">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PREMIUM HIGH-FIDELITY INTERACTIVE 3D MOCKUP INSPECTOR MODAL --- */}
      {show3DMockupModal && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 md:p-6 animate-fade-in text-slate-800 dark:text-slate-100"
          onClick={() => setShow3DMockupModal(false)}
        >
          <div 
            className="bg-white dark:bg-[#080d24] w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-150 dark:border-indigo-950/50 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-850 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Layers className="w-5 h-5 text-indigo-500 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-850 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Интерактивный 3D-осмотр тиража партии</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 rounded-full border border-emerald-250/30">В ФОКУСЕ 100%</span>
                  </h3>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 leading-none">
                    Реалистичная симуляция физического носителя и его комплектации
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShow3DMockupModal(false)}
                className="w-10 h-10 rounded-full bg-slate-105 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white text-xl font-black transition-all cursor-pointer shrink-0 border border-slate-200/40 dark:border-slate-800/60"
              >
                &times;
              </button>
            </div>

            {/* Content area splitting into Canvas on left, controls on right */}
            <div className="flex-1 overflow-y-auto p-5 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/40 dark:bg-slate-950/20">
              
              {/* Left Panel: 3D stage with zero blur, maximum size and detailed textures */}
              <div className="lg:col-span-7 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-950 dark:to-slate-900 rounded-3xl border border-slate-200/60 dark:border-slate-850/50 p-6 flex flex-col justify-between relative min-h-[380px] md:min-h-[460px] overflow-hidden shadow-inner">
                {/* Simulated clean laboratory layout grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:24px_24px] opacity-20 pointer-events-none" />

                {/* Perspective scale center container */}
                <div 
                  className="my-auto mx-auto flex items-center justify-center transition-all duration-300 relative"
                  style={{
                    transform: `perspective(1000px) rotateX(${mockRotateX}deg) rotateY(${mockRotateY}deg) scale(${mockScale})`,
                    transformStyle: 'preserve-3d',
                  }}
                >
                  {/* Dynamic stacked shadow loop */}
                  {Array.from({ length: Math.min(8, copies) }).map((_, idx) => {
                    const isTopPage = idx === Math.min(8, copies) - 1;
                    const shiftX = idx * 3.5;
                    const shiftY = idx * -3.5;

                    let paperBgClass = 'bg-white text-slate-850';
                    if (paperType === 'kraft') {
                      paperBgClass = 'bg-[#f4e2cb] dark:bg-[#d0b490] text-amber-950';
                    } else if (paperType === 'glossy') {
                      paperBgClass = 'bg-slate-50 text-slate-900';
                    } else if (paperType === 'matte') {
                      paperBgClass = 'bg-[#fbfaf7] dark:bg-[#efede9] text-slate-900';
                    }

                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border transition-all duration-200 p-5 flex flex-col justify-between shadow-[4px_4px_16px_rgba(0,0,0,0.12)] border-slate-300/40 dark:border-slate-700/30 ${paperBgClass}`}
                        style={{
                          width: paperType === 'standard_a3' || paperType === 'bw_a3' ? '280px' : '230px',
                          height: paperType === 'standard_a3' || paperType === 'bw_a3' ? '390px' : '310px',
                          position: idx === 0 ? 'relative' : 'absolute',
                          left: `${shiftX}px`,
                          bottom: `${shiftY}px`,
                          top: idx === 0 ? 'auto' : `calc(0px + ${shiftY}px)`,
                          zIndex: idx + 1,
                          transform: 'translateZ(' + (idx * 2) + 'px)',
                        }}
                      >
                        {/* Shimmer reflection for glossy surfaces */}
                        {paperType === 'glossy' && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/40 rounded-xl pointer-events-none z-10" />
                        )}

                        {/* Staple simulation for active staple binding */}
                        {binding === 'staple' && isTopPage && (
                          <div className="absolute top-3 left-3 w-8 h-2 bg-slate-350 dark:bg-slate-400 border border-slate-400/80 -rotate-45 rounded-xs shadow-md z-20" />
                        )}

                        {/* Sleeve File simulation */}
                        {binding === 'file' && isTopPage && (
                          <div className="absolute inset-0 bg-sky-200/15 dark:bg-sky-400/5 border-2 border-sky-400/30 rounded-xl z-20 pointer-events-none shadow-inner" style={{ backdropFilter: 'blur(0.5px)' }}>
                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full border border-sky-500/15 flex items-center justify-center bg-white/90 shadow-md text-sky-600 font-extrabold text-[9px]">
                              5₽
                            </div>
                          </div>
                        )}

                        {/* Plastic and Metal spiral simulation */}
                        {(binding === 'spring_plastic' || binding === 'spring_metal') && isTopPage && (
                          <div className="absolute top-0 bottom-0 left-1 w-3.5 flex flex-col justify-around items-center z-20">
                            {Array.from({ length: 14 }).map((_, cIdx) => (
                              <div 
                                key={cIdx} 
                                className={`w-3.5 h-2 rounded-full border ${
                                  binding === 'spring_plastic' 
                                    ? 'bg-slate-900 border-slate-950 shadow-xs' 
                                    : 'bg-gradient-to-r from-slate-200 to-slate-400 border-slate-400'
                                }`} 
                              />
                            ))}
                          </div>
                        )}

                        {/* Hard cover binder simulation */}
                        {binding === 'hard_cover' && isTopPage && (
                          <div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-xl flex flex-col justify-between p-5 text-slate-100 z-20 shadow-xl border-t border-b border-indigo-900/40">
                            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                              <span className="text-[7.5px] font-mono tracking-widest text-[#d4af37] font-extrabold">КОПИ-СПЕЦИАЛИСТ</span>
                              <span className="text-[7.5px] font-mono font-bold">ОТДЕЛКА СЕМЕЙНАЯ</span>
                            </div>
                            <div className="my-auto space-y-2 text-center p-2 border border-slate-800/60 bg-slate-950/45 rounded-xl">
                              <div className="text-[9.5px] text-[#d4af37] font-black uppercase tracking-widest leading-normal">
                                Твёрдый переплёт премиум
                              </div>
                              <div className="text-[7.5px] text-slate-400 italic">
                                * Текстурная кожаная обложка *
                              </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-slate-800 pt-2 text-[7px] text-slate-400 font-mono">
                              <span>РАЗМЕР А4</span>
                              <span>МАТЕРИАЛ КНИЖНЫЙ</span>
                            </div>
                          </div>
                        )}

                        {/* Crisp interior content mockup - perfectly legible */}
                        {isTopPage && binding !== 'hard_cover' && (
                          <div className="w-full h-full flex flex-col justify-between text-left select-none relative p-1.5 pointer-events-none">
                            {uploadedFiles[0] && (uploadedFiles[0].previewUrl || (uploadedFiles[0].formatGroup === 'image' && uploadedFiles[0].url)) ? (
                              // Real Uploaded Image Preview
                              <div className="absolute inset-0 p-1 bg-white dark:bg-slate-900 rounded-xl overflow-hidden flex flex-col justify-between">
                                <div className="w-full h-[85%] relative rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-950 flex items-center justify-center">
                                  <img 
                                    src={uploadedFiles[0].previewUrl || uploadedFiles[0].url} 
                                    className="w-full h-full object-cover" 
                                    alt={uploadedFiles[0].name}
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="absolute top-1.5 right-1.5 bg-indigo-600 px-2 py-0.5 text-white text-[7px] font-black tracking-widest rounded-md">
                                    ОРИГИНАЛ МАКЕТА
                                  </div>
                                </div>
                                <div className="flex justify-between items-center text-[7.5px] font-bold text-slate-500 font-mono px-0.5">
                                  <span className="truncate max-w-[170px]">{uploadedFiles[0].name}</span>
                                  <span>{formatFileSize(uploadedFiles[0].size)}</span>
                                </div>
                              </div>
                            ) : uploadedFiles[0] ? (
                              // Real Uploaded Document Preview Layout
                              <div className="w-full h-full flex flex-col justify-between">
                                {/* Paper top metadata stamp */}
                                <div className="flex justify-between items-center text-[7.5px] font-mono font-black text-indigo-500 uppercase tracking-widest">
                                  <span>Копи-Север • 2026</span>
                                  <span>{paperType === 'standard_a3' || paperType === 'bw_a3' ? 'ФОРМАТ А3' : 'ФОРМАТ А4'}</span>
                                </div>

                                {/* Crisp graphics and title simulator */}
                                <div className="my-auto py-2.5 space-y-2.5">
                                  {/* Simulated clean stamp or header */}
                                  <div className="border border-dashed border-indigo-400/40 bg-indigo-50/10 p-2.5 rounded-xl space-y-1">
                                    <div className="text-[10px] font-black tracking-wide text-indigo-700 dark:text-indigo-400">
                                      {uploadedFiles[0].name.toUpperCase()}
                                    </div>
                                    <div className="text-[7.5px] text-slate-500 dark:text-slate-400 font-bold font-mono">
                                      {formatFileSize(uploadedFiles[0].size)} • {uploadedFiles[0].pageCount || 1} стр.
                                    </div>
                                  </div>

                                  {/* Simulated detailed paragraph blocks */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-3 h-3 rounded-full bg-indigo-505 flex items-center justify-center text-[7px] text-white font-black">1</div>
                                      <p className="text-[8.5px] font-extrabold text-slate-750 dark:text-slate-300">Реальные параметры партии:</p>
                                    </div>
                                    <div className="pl-4 space-y-1">
                                      <div className="h-1 bg-slate-300 dark:bg-slate-700 rounded-full w-full" />
                                      <div className="h-1 bg-slate-300 dark:bg-slate-700 rounded-full w-5/6" />
                                      <div className="h-1 bg-slate-350 dark:bg-slate-650 rounded-full w-11/12" />
                                    </div>
                                  </div>

                                  {/* Real parameters stamped inside mockup page */}
                                  <div className="bg-slate-100/50 dark:bg-slate-900/55 p-2 rounded-lg text-[7px] font-mono space-y-0.5 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/40">
                                    <div>Плотность: {paperDensity === 'thick' ? 'Плотная 160 г/м²' : 'Стандартная 80 г/м²'}</div>
                                    <div>Тираж: {copies} шт • Страниц: {uploadedFiles.reduce((acc, f) => acc + (f.pageCount || 1), 0)}</div>
                                    <div>Скрепление: {binding === 'none' ? 'Нет' : binding === 'staple' ? 'Степлер (угол)' : binding === 'file' ? 'Файлик' : binding === 'spring_metal' ? 'Металлическая пружина' : binding === 'spring_plastic' ? 'Пластиковая пружина' : 'Твёрдый переплет'}</div>
                                  </div>
                                </div>

                                {/* Stamps or bottom seals */}
                                <div className="flex justify-between items-end border-t border-slate-200/60 dark:border-slate-800/60 pt-2 text-[7px] font-bold text-slate-400">
                                  <div className="space-y-0.5">
                                    <span className="block italic">Подготовлено в печать:</span>
                                    <span className="block font-mono text-indigo-650 dark:text-indigo-400">{user.fullName || 'Гость-Клиент'}</span>
                                  </div>
                                  
                                  {/* Colored Visual circle stamp */}
                                  {printColor === 'bw' ? (
                                    <div className="w-8 h-8 rounded-full border border-double border-slate-400 flex items-center justify-center text-[6.5px] font-bold font-mono text-slate-400 -rotate-12 transform">
                                      Ч/Б СТАНДАРТ
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border border-double border-indigo-500 flex items-center justify-center text-[6.5px] font-mono font-black text-indigo-500 -rotate-12 transform bg-indigo-50/25 animate-pulse">
                                      100% ЦВЕТ
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              // Fallback standard render
                              <>
                                {/* Paper top metadata stamp */}
                                <div className="flex justify-between items-center text-[7.5px] font-mono font-black text-indigo-500 uppercase tracking-widest">
                                  <span>Копи-Север • 2026</span>
                                  <span>{paperType === 'standard_a3' || paperType === 'bw_a3' ? 'ФОРМАТ А3' : 'ФОРМАТ А4'}</span>
                                </div>

                                <div className="my-auto py-2.5 space-y-2.5">
                                  <div className="border border-dashed border-indigo-400/40 bg-indigo-50/10 p-2 rounded-lg space-y-1">
                                    <div className="text-[9px] font-black tracking-wide text-slate-800 dark:text-slate-200">
                                      DOCUMENT_REPORT.PDF
                                    </div>
                                    <div className="text-[7px] text-slate-450 dark:text-slate-500 font-medium">
                                      Типография: Северное шоссе, 18 • 1.04 MB • 1 стр.
                                    </div>
                                  </div>

                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 flex items-center justify-center text-[6px] text-white font-black">1</div>
                                      <p className="text-[8px] font-semibold text-slate-750 dark:text-slate-300">Спецификация партии на печать:</p>
                                    </div>
                                    <div className="pl-4 space-y-1">
                                      <div className="h-1 bg-slate-300 dark:bg-slate-700 rounded-full w-full" />
                                      <div className="h-1 bg-slate-300 dark:bg-slate-700 rounded-full w-5/6" />
                                    </div>
                                  </div>

                                  <div className="bg-slate-100/50 dark:bg-slate-900/55 p-2 rounded-lg text-[7px] font-mono space-y-0.5 text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/40">
                                    <div>Плотность: {paperDensity === 'thick' ? 'Плотная 160 г/м²' : 'Стандартная 80 г/м²'}</div>
                                    <div>Тираж: {copies} шт • Страниц: 1</div>
                                    <div>Скрепление: {binding === 'none' ? 'Нет' : binding === 'staple' ? 'Степлер (угол)' : binding === 'file' ? 'Файлик' : binding === 'spring_metal' ? 'Металлическая пружина' : binding === 'spring_plastic' ? 'Пластиковая пружина' : 'Твёрдый переплет'}</div>
                                  </div>
                                </div>

                                <div className="flex justify-between items-end border-t border-slate-200/60 dark:border-slate-800/60 pt-2 text-[7px] font-bold text-slate-400">
                                  <div className="space-y-0.5">
                                    <span className="block italic">Подготовлено в печать:</span>
                                    <span className="block font-mono text-indigo-600 dark:text-indigo-400">{user.fullName || 'Гость-Клиент'}</span>
                                  </div>
                                  
                                  {printColor === 'bw' ? (
                                    <div className="w-8 h-8 rounded-full border border-double border-slate-400 flex items-center justify-center text-[6.5px] font-bold font-mono text-slate-400 -rotate-12 transform">
                                      Ч/Б СТАНДАРТ
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-full border border-double border-indigo-500 flex items-center justify-center text-[6.5px] font-mono font-black text-indigo-500 -rotate-12 transform bg-indigo-50/25 animate-pulse">
                                      100% ЦВЕТ
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Perspective stats overlay on the bottom left of canvas */}
                <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white font-mono text-[9px] p-2.5 rounded-xl space-y-0.5 border border-slate-800 z-30 shadow-lg select-none backdrop-blur-xs">
                  <div>X-ROTATION: {mockRotateX}°</div>
                  <div>Y-ROTATION: {mockRotateY}°</div>
                  <div>ZOOM-LEVEL: {mockScale.toFixed(2)}x</div>
                </div>
              </div>

              {/* Right Panel: Controls & sliders & custom settings in full focus */}
              <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                
                {/* 3D stage rotation and tilt controls */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-150 dark:border-slate-800 space-y-4">
                  <h4 className="text-xs font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-850 pb-2.5">
                    <Sliders className="w-4 h-4 text-indigo-500" />
                    <span>Управление 3D-манекеном</span>
                  </h4>

                  {/* Horizontal rotation input slider */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-350">Вращение по горизонтали:</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{mockRotateY}°</span>
                    </div>
                    <input 
                      type="range"
                      min="-75"
                      max="75"
                      value={mockRotateY}
                      onChange={(e) => setMockRotateY(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>СЛЕВА (-75°)</span>
                      <span>ФРОНТ (0°)</span>
                      <span>СПРАВА (75°)</span>
                    </div>
                  </div>

                  {/* Pitch tilt input slider */}
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-350">Наклон по вертикали:</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{mockRotateX}°</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="75"
                      value={mockRotateX}
                      onChange={(e) => setMockRotateX(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>ВИД СБОКУ (0°)</span>
                      <span>ИДЕАЛЬНЫЙ НАКЛОН (25°)</span>
                      <span>ВИД СВЕРХУ (75°)</span>
                    </div>
                  </div>

                  {/* Zoom slider */}
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-350">Масштабирование (Zoom):</span>
                      <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{mockScale.toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range"
                      min="0.8"
                      max="2.0"
                      step="0.05"
                      value={mockScale}
                      onChange={(e) => setMockScale(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-[9px] text-slate-400 font-bold">
                      <span>ОТДАЛИТЬ (0.8x)</span>
                      <span>ПРИБЛИЗИТЬ (2.0x)</span>
                    </div>
                  </div>
                </div>

                {/* Live Info card */}
                <div className="p-4.5 bg-indigo-50/50 dark:bg-slate-900/60 rounded-2xl border border-indigo-100/50 dark:border-indigo-950/45 text-xs text-indigo-805 dark:text-indigo-305 space-y-1.5 leading-relaxed">
                  <p className="font-extrabold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <span>Совет по 3D-макету:</span>
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Макет отображается в реальном времени под прямым освещением («в фокусе»). Вы можете детально изучить зазоры под пружинную брошюровку, глазурованный блеск глянцевой текстуры и угол наклона листов перед проведением платежа.
                  </p>
                </div>
              </div>

            </div>

            {/* Footer with actions */}
            <div className="p-4 border-t border-slate-150 dark:border-slate-850 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/45 shrink-0">
              <button
                onClick={() => {
                  setMockRotateX(25);
                  setMockRotateY(15);
                  setMockScale(1.2);
                }}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-850 text-xs font-bold transition-all cursor-pointer text-slate-650 dark:text-slate-350"
              >
                Сбросить вращение
              </button>
              <button
                onClick={() => setShow3DMockupModal(false)}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer shadow-md shadow-indigo-600/10"
              >
                Готово, вернуться к заказу
              </button>
            </div>
          </div>
        </div>
      )}
      {payingOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden text-left transform transition-all">
            
            {/* Header with SSL Badge */}
            <div className="p-5 border-b border-slate-150 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/30">
              <div>
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Защищенный шлюз Копи-банка</h3>
                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">ВЫСТАВЛЕН СЧЕТ ПО ЗАКАЗУ: <strong>{payingOrder.id}</strong></span>
              </div>
              <button
                onClick={() => setPayingOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-black"
              >
                &times;
              </button>
            </div>

            <div className="p-6 space-y-5">
              
              {/* Security indicators */}
              <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-150 rounded-xl text-[10px] text-emerald-800 dark:text-emerald-400 font-bold">
                <Shield className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                <span>Шифрование связи TLS 1.3 и стандарт безопасности PCI-DSS</span>
              </div>

              {/* Method toggler */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'card', label: 'Карта' },
                  { id: 'sbp', label: 'СБП' },
                  { id: 'qr', label: 'По QR-коду' },
                  { id: 'on_receipt', label: 'При получении' }
                ].map(method => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id as any)}
                    className={`py-2 px-1 text-center font-bold text-[11px] rounded-xl border transition cursor-pointer ${
                      paymentMethod === method.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-extrabold shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              {/* Total cost badge */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950 rounded-2xl flex justify-between items-center text-xs border border-slate-150/40">
                <span className="font-bold text-slate-550">
                  {paymentMethod === 'on_receipt' ? 'К оплате при получении:' : 'Сумма списания:'}
                </span>
                <span className="text-base font-black text-slate-900 dark:text-white">₽{payingOrder.totalCost}</span>
              </div>

              {/* CARD CONTAINER FLOW */}
              {paymentMethod === 'card' && (
                <form onSubmit={processSecurePayment} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Номер банковской карты</label>
                    <input
                      type="text"
                      required
                      placeholder="4276 3800 1234 5678"
                      value={cardNumber}
                      maxLength={19}
                      onChange={e => {
                        // Card formatting auto structure
                        const val = e.target.value.replace(/\D/g, '').match(/.{1,4}/g)?.join(' ') || '';
                        setCardNumber(val);
                      }}
                      className="block w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Срок действия</label>
                      <input
                        type="text"
                        required
                        placeholder="MM/YY"
                        maxLength={5}
                        value={cardExpiry}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          if (val.length > 2) {
                            setCardExpiry(val.slice(0, 2) + '/' + val.slice(2, 4));
                          } else {
                            setCardExpiry(val);
                          }
                        }}
                        className="block w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950 text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CVC / CVC2</label>
                      <input
                        type="password"
                        required
                        placeholder="***"
                        maxLength={3}
                        value={cardCvv}
                        onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                        className="block w-full p-2.5 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-955 text-xs focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer bg-indigo-605"
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Шифрование и списание...
                      </>
                    ) : (
                      <>Произвести оплату ₽{payingOrder.totalCost}</>
                    )}
                  </button>
                </form>
              )}

              {/* SBP QR FLOW */}
              {paymentMethod === 'sbp' && (
                <div className="text-center space-y-4">
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed">
                    Быстрая и защищенная оплата без ввода реквизитов банковской карты. Выберите ваш мобильный банк для моментального перехода в приложение СБП:
                  </p>
                  
                  {/* Bank Grid */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: 'Sber', label: 'Сбер', color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
                      { name: 'T-Bank', label: 'Т-Банк', color: 'bg-yellow-400 hover:bg-yellow-500 text-slate-950' },
                      { name: 'Alfa', label: 'Альфа', color: 'bg-rose-600 hover:bg-rose-700 text-white' },
                      { name: 'VTB', label: 'ВТБ', color: 'bg-blue-600 hover:bg-blue-700 text-white' }
                    ].map(bank => (
                      <button
                        key={bank.name}
                        type="button"
                        onClick={processSecurePayment}
                        className={`py-2.5 px-1 rounded-xl text-[10px] font-black uppercase text-center cursor-pointer transition-transform hover:scale-105 active:scale-95 duration-150 ${bank.color}`}
                      >
                        {bank.label}
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold tracking-wider my-1 uppercase">ИЛИ ПОДТВЕРДИТЕ ПЕРЕВОД:</div>

                  <button
                    onClick={processSecurePayment}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Проверка зачисления СБП...
                      </>
                    ) : (
                      <>Я перевел через мобильный банк</>
                    )}
                  </button>
                </div>
              )}

              {/* QR CODE PAYMENT FLOW */}
              {paymentMethod === 'qr' && (
                <div className="text-center space-y-4">
                  <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed">
                    Отсканируйте код ниже вашей камерой для проведения моментальной транзакции через Систему Быстрых Платежей или Копи-Банк:
                  </p>
                  
                  {/* Real-like QR-code wrapping camera grid frame */}
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 inline-block rounded-3xl border border-slate-150 dark:border-slate-800 relative shadow-inner">
                    <div className="absolute top-2 left-2 w-3.5 h-3.5 border-t-2 border-l-2 border-indigo-600 dark:border-indigo-400 rounded-tl-sm"></div>
                    <div className="absolute top-2 right-2 w-3.5 h-3.5 border-t-2 border-r-2 border-indigo-600 dark:border-indigo-400 rounded-tr-sm"></div>
                    <div className="absolute bottom-2 left-2 w-3.5 h-3.5 border-b-2 border-l-2 border-indigo-600 dark:border-indigo-400 rounded-bl-sm"></div>
                    <div className="absolute bottom-2 right-2 w-3.5 h-3.5 border-b-2 border-r-2 border-indigo-600 dark:border-indigo-400 rounded-br-sm"></div>
                    
                    <svg className="w-44 h-44 mx-auto" viewBox="0 0 100 100" fill="none">
                      {/* Stylized QR patterns */}
                      <rect x="5" y="5" width="25" height="25" stroke="currentColor" strokeWidth="5" className="text-indigo-600 dark:text-indigo-400" />
                      <rect x="12" y="12" width="11" height="11" fill="currentColor" className="text-indigo-600 dark:text-indigo-400" />
                      <rect x="70" y="5" width="25" height="25" stroke="currentColor" strokeWidth="5" className="text-indigo-600 dark:text-indigo-400" />
                      <rect x="77" y="12" width="11" height="11" fill="currentColor" className="text-indigo-650 dark:text-indigo-400" />
                      <rect x="5" y="70" width="25" height="25" stroke="currentColor" strokeWidth="5" className="text-indigo-600 dark:text-indigo-400" />
                      <rect x="12" y="77" width="11" height="11" fill="currentColor" className="text-indigo-655 dark:text-indigo-400" />
                      
                      {/* Static codes */}
                      <rect x="40" y="10" width="12" height="4" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      <rect x="52" y="18" width="6" height="12" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      <rect x="35" y="32" width="20" height="6" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      <rect x="72" y="45" width="10" height="10" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      <rect x="45" y="72" width="15" height="15" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      <rect x="75" y="75" width="15" height="5" fill="currentColor" className="text-slate-800 dark:text-slate-205" />
                      
                      {/* Center SBP/System branding */}
                      <circle cx="50" cy="50" r="10" fill="#1e1b4b" />
                      <path d="M47 48 L53 48 L50 53 ZM46 51 H54" stroke="white" strokeWidth="1.5" />
                    </svg>
                    <div className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 mt-1 select-none">ПЕЧАТЬ 24 QR</div>
                  </div>

                  <button
                    onClick={processSecurePayment}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Сканирование и зачисление...
                      </>
                    ) : (
                      <>Я оплатил с помощью QR-кода</>
                    )}
                  </button>
                </div>
              )}

              {/* PAYMENT ON RECEIPT FLOW */}
              {paymentMethod === 'on_receipt' && (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-550/5 dark:bg-blue-950/15 border border-blue-100 dark:border-blue-900/40 rounded-2xl text-xs space-y-2.5 text-slate-600 dark:text-slate-350 leading-relaxed text-left">
                    <p className="font-extrabold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                      <span>ℹ️ Оплата при выдаче в копицентре</span>
                    </p>
                    <p>
                      Вы можете оплатить Ваш заказ наличными или банковской картой непосредственно при получении готовых распечаток.
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                      * Печать Вашего заказа начнется сразу, как оператор проверит файлы на соответствие!
                    </p>
                  </div>

                  <button
                    onClick={processSecurePayment}
                    disabled={isProcessingPayment}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isProcessingPayment ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Оформление заказа...
                      </>
                    ) : (
                      <>Оформить заказ с оплатой при получении</>
                    )}
                  </button>
                </div>
              )}

              {/* Show completed visual */}
              {paymentCompleted && (
                <div className="absolute inset-0 bg-white dark:bg-slate-900 flex flex-col justify-center items-center text-center p-6 z-10 transition-all duration-300">
                  <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <Check className="w-10 h-10" />
                  </div>
                  <h4 className="text-base font-black text-slate-800 dark:text-white">
                    {paymentMethod === 'on_receipt' ? 'Заказ успешно оформлен!' : 'Транзакция успешно проведена!'}
                  </h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    {paymentMethod === 'on_receipt' 
                      ? 'Инструкции по заказу отправлены оператору. Печать уже запускается!' 
                      : 'Счет закрыт. Копии файлов авторизованы для печати на ПК оператора.'}
                  </p>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

      {/* CUSTOM SELF DELETE CONFIRMATION MODAL */}
      {showSelfDeleteModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] animate-fade-in">
          <div 
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-850 shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400 mb-4">
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-100/50 dark:border-rose-900/35">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 dark:text-white">Удаление аккаунта</h3>
                <p className="text-[10px] text-slate-400 font-bold">Это действие невозможно отменить</p>
              </div>
            </div>

            <div className="space-y-3 my-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800/80 text-xs text-slate-650 dark:text-slate-300 leading-relaxed font-semibold">
                Вы действительно хотите навсегда удалить ваш личный кабинет и стереть все загруженные файлы?
                <p className="mt-2 text-rose-600 dark:text-rose-400 font-extrabold">
                  &bull; Вы потеряете доступ к истории заказов и активной переписке с печатным центром.
                </p>
              </div>
              {selfDeleteError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-xs font-bold text-rose-650 border border-rose-200/50 rounded-xl leading-relaxed">
                  {selfDeleteError}
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowSelfDeleteModal(false);
                  setSelfDeleteError(null);
                }}
                disabled={isDeletingSelf}
                className="flex-1 py-3 border border-slate-205 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 rounded-2xl text-xs font-bold transition hover:bg-slate-50 dark:hover:bg-slate-900"
              >
                Отменить
              </button>
              <button
                onClick={confirmDeleteSelf}
                disabled={isDeletingSelf}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-lg shadow-rose-600/10"
              >
                {isDeletingSelf ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Удаление...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Удалить аккаунт</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFETTI DELIGHT BURST OVERLAY */}
      {confettiActive && (
        <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {Array.from({ length: 50 }).map((_, i) => {
            const left = Math.random() * 100; // random percentage
            const delay = Math.random() * 1.2;
            const duration = 2.5 + Math.random() * 2.5;
            const size = 5 + Math.random() * 11;
            const rotate = Math.random() * 360;
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f43f5e', '#a855f7'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return (
              <motion.div
                key={i}
                initial={{ y: -50, x: `${left}vw`, rotate: 0, opacity: 1 }}
                animate={{ 
                  y: '105vh', 
                  x: `${left + (Math.random() * 24 - 12)}vw`, 
                  rotate: rotate + 720, 
                  opacity: [1, 1, 0.8, 0] 
                }}
                transition={{ 
                  duration, 
                  delay, 
                  ease: [0.1, 0.8, 0.3, 1] 
                }}
                style={{
                  position: 'absolute',
                  width: size,
                  height: size * (Math.random() > 0.45 ? 1 : 1.6),
                  backgroundColor: color,
                  borderRadius: Math.random() > 0.5 ? '50%' : '3px',
                }}
              />
            );
          })}
        </div>
      )}

      {/* GIFT PROMO MODAL FOR CLIENT */}
      {showPromoGiftModal && user.promoCode && (
        <div id="promo-postcard-modal" className="fixed inset-0 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 180 }}
            className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-3xl overflow-hidden max-w-md w-full shadow-2xl relative flex flex-col"
          >
            {/* Christmas/Gift Ribbon Visual Banner */}
            <div className="h-44 relative overflow-hidden bg-slate-100 dark:bg-slate-950">
              <img 
                src="https://images.unsplash.com/photo-1549465220-1a8b9238cd48?q=80&w=600&auto=format&fit=crop" 
                alt="Подарочная упаковка" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
              
              <div className="absolute bottom-4 left-5 right-5 flex justify-between items-end">
                <span className="bg-emerald-500 text-white text-[10px] uppercase font-black px-2.5 py-1 rounded-full border border-emerald-400/40 tracking-wider">
                  Персональный Подарок 🎁
                </span>
                <span className="font-mono text-xs text-white/70 font-semibold">Копи-точка А4 / А3</span>
              </div>

              {/* Floating absolute decorative absolute shapes */}
              <div className="absolute top-3 left-4 text-xl animate-bounce">🎁</div>
              <div className="absolute top-2 right-4 text-lg animate-bounce delay-150">🎉</div>
            </div>

            {/* Postcard Body */}
            <div className="p-6 sm:p-8 space-y-5 text-center">
              <div className="space-y-1.5">
                <h3 className="text-lg font-black text-slate-850 dark:text-white uppercase tracking-wider font-sans">
                  Праздничная Открытка!
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  Специально для пользователя: <span className="text-slate-700 dark:text-slate-200">{user.fullName}</span>
                </p>
              </div>

              <div className="border-t border-dashed border-slate-200 dark:border-slate-800 my-1" />

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                Администратор нашего копи-центра приготовил для Вас уникальный подарок в благодарность за доверие к нашему сервису!
              </p>

              {/* Glowing Coupon Display */}
              <div className="bg-emerald-50/20 dark:bg-emerald-950/15 border border-dashed border-emerald-500/30 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 tracking-widest block uppercase">Ваш личный промокод:</span>
                
                <h2 className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-widest bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 py-2.5 px-4 rounded-xl shadow-xs inline-block">
                  {user.promoCode}
                </h2>

                <div className="text-[11px] font-black text-emerald-650 bg-emerald-50 dark:bg-emerald-900/30 py-1.5 px-3 rounded-xl border border-emerald-500/10 inline-flex items-center gap-1.5">
                  Скидка на все услуги печати: <span className="text-sm font-extrabold text-amber-500">-{user.promoDiscount}%</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                Скопируйте промокод и примените его при оформлении следующего заказа, чтобы применить скидку в {user.promoDiscount}%!
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  onClick={() => handleDismissPromoGift(false)}
                  className="py-3 px-4 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-705 dark:text-slate-300 rounded-2xl transition cursor-pointer"
                >
                  Просто закрыть
                </button>
                <button
                  onClick={() => handleDismissPromoGift(true)}
                  className="py-3 px-4 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg shadow-emerald-600/15 transition cursor-pointer"
                >
                  🎁 Скопировать и применить!
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}

      {/* TORN PAPER PROMO CODE EFFECT OVERLAY */}
      {showTornPaperAnimation && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-[10000] overflow-hidden">
          {/* Confetti or dust particles from tearing */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {Array.from({ length: 30 }).map((_, i) => {
              const angle = Math.random() * Math.PI * 2;
              const distance = 100 + Math.random() * 200;
              const delay = 0.2 + Math.random() * 0.4;
              return (
                <motion.div
                  key={i}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{ 
                    x: Math.cos(angle) * distance, 
                    y: Math.sin(angle) * distance + 50, 
                    scale: 0, 
                    opacity: 0,
                    rotate: 360 
                  }}
                  transition={{ duration: 1.5, delay, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 w-2 h-2 rounded-sm bg-[#faf9f5]"
                  style={{ transform: 'translate(-50%, -50%)' }}
                />
              );
            })}
          </div>

          <div className="text-center space-y-4 mb-10 z-10">
            <motion.h3 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xl sm:text-2xl font-black text-rose-500 uppercase tracking-widest"
            >
              ✂️ Промокод успешно использован!
            </motion.h3>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/70 text-xs font-semibold max-w-xs mx-auto"
            >
              Ваш персональный купон разрывается, скидка зафиксирована в заказе! Повторное применение заблокировано.
            </motion.p>
          </div>

          {/* Ticket Wrapper */}
          <div className="relative w-full max-w-sm h-64 flex justify-between gap-1 select-none overflow-hidden pr-2">
            
            {/* LEFT HALF */}
            <motion.div
              initial={{ x: 0, rotate: 0, opacity: 1 }}
              animate={{ x: -160, rotate: -12, opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.36, 0, 0.66, -0.1], delay: 0.5 }}
              className="w-1/2 h-full bg-[#fcfbfa] dark:bg-slate-900 border-y border-l border-dashed border-rose-500/30 rounded-l-3xl p-6 relative flex flex-col justify-between overflow-hidden shadow-2xl"
            >
              {/* Decorative side punch notch */}
              <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-black rounded-full"></div>
              
              <div className="space-y-2">
                <div className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Активация</div>
                <div className="text-2xl font-black text-slate-850 dark:text-slate-205 font-mono">
                  {tornPromoCode.slice(0, Math.ceil(tornPromoCode.length / 2))}
                </div>
              </div>

              <div className="text-[10px] font-bold text-slate-450 font-mono">
                КОПИ-ЦЕНТР
              </div>

              {/* Ripped Edge inside Right Margin */}
              <div className="absolute right-0 top-0 bottom-0 w-2 flex flex-col justify-between overflow-hidden pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-black rounded-full -mr-3" />
                ))}
              </div>
            </motion.div>

            {/* RIGHT HALF */}
            <motion.div
              initial={{ x: 0, rotate: 0, opacity: 1 }}
              animate={{ x: 160, rotate: 12, opacity: 0 }}
              transition={{ duration: 1.4, ease: [0.36, 0, 0.66, -0.1], delay: 0.5 }}
              className="w-1/2 h-full bg-[#fcfbfa] dark:bg-slate-900 border-y border-r border-dashed border-rose-500/30 rounded-r-3xl p-6 relative flex flex-col justify-between overflow-hidden shadow-2xl"
            >
              {/* Decorative side punch notch */}
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-black rounded-full"></div>
              
              <div className="space-y-2 text-right">
                <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Скидка</div>
                <div className="text-2xl font-black text-slate-850 dark:text-slate-205 font-mono">
                  {tornPromoCode.slice(Math.ceil(tornPromoCode.length / 2))}
                </div>
              </div>

              <div className="text-[10px] font-black text-emerald-650 font-mono text-right">
                -ОДОБРЕНО-
              </div>

              {/* Ripped Edge inside Left Margin */}
              <div className="absolute left-0 top-0 bottom-0 w-2 flex flex-col justify-between overflow-hidden pointer-events-none">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-black rounded-full -ml-3" />
                ))}
              </div>
            </motion.div>

          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            onClick={() => setShowTornPaperAnimation(false)}
            className="mt-10 px-8 py-3 bg-white hover:bg-slate-50 text-slate-900 text-xs font-black rounded-2xl shadow-lg cursor-pointer transform hover:scale-[1.03] transition z-10"
          >
            Отлично, продолжить 👍
          </motion.button>
        </div>
      )}

    </div>
  );
}
