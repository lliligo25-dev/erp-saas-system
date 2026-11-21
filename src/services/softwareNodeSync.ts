/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { erpEngine } from './erpEngine';
import {
  ORDERABLE_SOFTWARE_CATALOG,
  SoftwareModuleSubscription,
  SoftwareOrderReceipt,
  getMemberModuleSubscriptions,
  getMemberOrderReceipts,
  getMemberUnlockedPacks,
  saveMemberModuleSubscriptions,
} from './memberFiveStarConfig';

export const NODES_UPDATED_EVENT = 'ais-nodes-updated';

export function notifyNodesUpdated(memberMid?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NODES_UPDATED_EVENT, { detail: { memberMid } }));
  }
}

export interface PurchasedProductNodeEntry {
  nodeId: string;
  moduleKey: string;
  productTitle: string;
  codeLabel: string;
  licenseCode: string;
  orderId?: string;
  purchasedAt?: string;
  amountNtd?: number;
  isExtraSeat: boolean;
}

/**
 * 將會員名下新購買/開通的 AI 產品與軟體模組，自動核對並同步寫入名下雙軌節點清冊 (erpEngine.binaryNodes)
 */
export function syncMemberPurchasedProductsToNodes(
  memberMid: string
): PurchasedProductNodeEntry[] {
  const member = erpEngine.getMemberById(memberMid);
  if (!member) return [];

  const mid = member.mid;
  const subs = getMemberModuleSubscriptions(mid, member.trialExpiresAt);
  const unlocked = getMemberUnlockedPacks(mid);
  const receipts = getMemberOrderReceipts(mid);
  let subsChanged = false;

  // 1. 確保 1+1 核心節點標籤完整
  if (member.binaryNodeId) {
    const mainBi = erpEngine.getBinaryNodeById(member.binaryNodeId);
    if (mainBi && !mainBi.softwareKey) {
      mainBi.softwareKey = 'EVENT';
      mainBi.softwareTitle = '活動行銷';
    }
    if (subs.EVENT && !subs.EVENT.binaryNodeId) {
      subs.EVENT.binaryNodeId = member.binaryNodeId;
      if (mainBi) {
        subs.EVENT.binaryParentId = mainBi.parentId;
        subs.EVENT.binaryDepth = mainBi.depth;
        if (
          mainBi.placementPosition === 'L' ||
          mainBi.placementPosition === 'R' ||
          mainBi.placementPosition === 'ROOT'
        ) {
          subs.EVENT.binaryPosition = mainBi.placementPosition;
        }
      }
      subsChanged = true;
    }
  }

  // 2. 確保第 3 種 AI 個人預約系統若已開通/訂購，同步綁定雙軌節點
  const bookingHasReceipt = receipts.some((r) => r.items.some((it) => it.moduleKey === 'BOOKING'));
  const existingBk = erpEngine.getBookingProfile(mid);
  if (existingBk || unlocked.includes('BOOKING') || bookingHasReceipt) {
    const bk = erpEngine.activateBookingTrial(mid, { allocateBinaryNode: true });
    const bkNode = bk.binaryNodeId ? erpEngine.getBinaryNodeById(bk.binaryNodeId) : undefined;
    if (bkNode && !subs.BOOKING?.binaryNodeId) {
      subs.BOOKING = {
        moduleKey: 'BOOKING',
        licenseCode: bk.licenseId,
        status: bk.status === 'ACTIVE_RENEWED' ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE',
        activatedAt: bk.activatedAt,
        expiresAt: bk.expiresAt,
        monthlyRentNtd: 100,
        totalRenewalsCount: bk.totalRenewalsCount,
        binaryNodeId: bkNode.nodeId,
        binaryParentId: bkNode.parentId,
        binaryPosition:
          bkNode.placementPosition === 'L' ||
          bkNode.placementPosition === 'R' ||
          bkNode.placementPosition === 'ROOT'
            ? bkNode.placementPosition
            : undefined,
        binaryDepth: bkNode.depth,
        extraBinaryNodeIds: subs.BOOKING?.extraBinaryNodeIds,
      };
      subsChanged = true;
    }
  }

  // 3. 檢查所有可訂購產品/AI 模組，凡已開通、已訂閱或有訂購收據但尚未在雙軌樹建立節點者，自動補齊並加入名下節點清冊
  ORDERABLE_SOFTWARE_CATALOG.forEach((cat) => {
    if (cat.isCore1Plus1 || cat.isBooking) return;

    const curSub: SoftwareModuleSubscription | undefined = subs[cat.key];
    const hasActiveSub = Boolean(curSub && curSub.status !== 'NOT_ORDERED');
    const isUnlocked = unlocked.includes(cat.key);
    const hasReceipt = receipts.some((r) => r.items.some((it) => it.moduleKey === cat.key));

    if (!hasActiveSub && !isUnlocked && !hasReceipt) return;

    const existingNode = curSub?.binaryNodeId
      ? erpEngine.getBinaryNodeById(curSub.binaryNodeId)
      : undefined;

    if (!existingNode) {
      const allocated = erpEngine.allocateBinaryNodeForSoftware({
        memberMid: mid,
        softwareKey: cat.key,
        softwareTitle: cat.title,
        status: curSub?.status === 'ACTIVE_RENEWED' ? 'ACTIVE_RENEWED' : 'TRIAL_ACTIVE',
        expiresAt: curSub?.expiresAt,
        executeSettlement: false,
      });

      const bPos =
        allocated.binaryNode.placementPosition === 'L' ||
        allocated.binaryNode.placementPosition === 'R' ||
        allocated.binaryNode.placementPosition === 'ROOT'
          ? allocated.binaryNode.placementPosition
          : undefined;

      subs[cat.key] = {
        moduleKey: cat.key,
        licenseCode: curSub?.licenseCode || `SW-${cat.key}-${mid.replace(/[^A-Z0-9]/gi, '')}`,
        status: curSub && curSub.status !== 'NOT_ORDERED' ? curSub.status : 'TRIAL_ACTIVE',
        activatedAt: curSub?.activatedAt || new Date().toISOString(),
        expiresAt: curSub?.expiresAt || allocated.binaryNode.trialExpiresAt,
        monthlyRentNtd: 100,
        totalRenewalsCount: curSub?.totalRenewalsCount || 0,
        lastSettlementTxnId: curSub?.lastSettlementTxnId,
        binaryNodeId: allocated.binaryNode.nodeId,
        binaryParentId: allocated.binaryNode.parentId,
        binaryPosition: bPos,
        binaryDepth: allocated.binaryNode.depth,
        extraBinaryNodeIds: curSub?.extraBinaryNodeIds,
      };
      subsChanged = true;
    } else if (!existingNode.softwareKey) {
      existingNode.softwareKey = cat.key;
      existingNode.softwareTitle = cat.title;
    }
  });

  if (subsChanged) {
    saveMemberModuleSubscriptions(mid, subs);
  }

  return getPurchasedProductNodeEntries(mid, subs, receipts);
}

export function getPurchasedProductNodeEntries(
  memberMid: string,
  subsArg?: Record<string, SoftwareModuleSubscription>,
  receiptsArg?: SoftwareOrderReceipt[]
): PurchasedProductNodeEntry[] {
  const member = erpEngine.getMemberById(memberMid);
  if (!member) return [];

  const subs = subsArg || getMemberModuleSubscriptions(member.mid, member.trialExpiresAt);
  const receipts = receiptsArg || getMemberOrderReceipts(member.mid);
  const entries: PurchasedProductNodeEntry[] = [];
  const seenNodeIds = new Set<string>();

  // 優先從訂購收據建立「新購買產品 → 節點」對照
  receipts.forEach((receipt) => {
    receipt.items.forEach((item) => {
      if (!item.binaryNodeId || seenNodeIds.has(item.binaryNodeId)) return;
      const cat = ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === item.moduleKey);
      const sub = subs[item.moduleKey];
      seenNodeIds.add(item.binaryNodeId);
      entries.push({
        nodeId: item.binaryNodeId,
        moduleKey: item.moduleKey,
        productTitle: item.title,
        codeLabel: cat?.codeLabel || item.codeLabel,
        licenseCode: sub?.licenseCode || `SW-${item.moduleKey}`,
        orderId: receipt.orderId,
        purchasedAt: receipt.createdAt,
        amountNtd: item.amountNtd,
        isExtraSeat: item.action === 'NEW_BINARY_SEAT',
      });
    });
  });

  // 補齊已訂閱/開通但尚未有收據紀錄的模組節點
  ORDERABLE_SOFTWARE_CATALOG.forEach((cat) => {
    if (cat.isCore1Plus1) return;
    const sub = subs[cat.key];
    if (!sub || sub.status === 'NOT_ORDERED') return;

    if (sub.binaryNodeId && !seenNodeIds.has(sub.binaryNodeId)) {
      seenNodeIds.add(sub.binaryNodeId);
      entries.push({
        nodeId: sub.binaryNodeId,
        moduleKey: cat.key,
        productTitle: cat.title,
        codeLabel: cat.codeLabel,
        licenseCode: sub.licenseCode,
        purchasedAt: sub.activatedAt,
        amountNtd: sub.status === 'ACTIVE_RENEWED' ? 100 : 0,
        isExtraSeat: false,
      });
    }

    (sub.extraBinaryNodeIds || []).forEach((extraId) => {
      if (!extraId || seenNodeIds.has(extraId)) return;
      seenNodeIds.add(extraId);
      entries.push({
        nodeId: extraId,
        moduleKey: cat.key,
        productTitle: cat.title,
        codeLabel: cat.codeLabel,
        licenseCode: sub.licenseCode,
        purchasedAt: sub.activatedAt,
        amountNtd: 100,
        isExtraSeat: true,
      });
    });
  });

  // 補齊直接透過 erpEngine.allocateBinaryNodeForSoftware 建立且標記非 1+1 核心之節點
  const allMemberBinary = erpEngine
    .getAllBinaryNodes()
    .filter((n) => n.mid === member.mid && !n.hqPermanentLocked && n.nodeId !== member.binaryNodeId);

  allMemberBinary.forEach((bn) => {
    if (seenNodeIds.has(bn.nodeId)) return;
    const cat = bn.softwareKey
      ? ORDERABLE_SOFTWARE_CATALOG.find((c) => c.key === bn.softwareKey)
      : undefined;
    seenNodeIds.add(bn.nodeId);
    entries.push({
      nodeId: bn.nodeId,
      moduleKey: bn.softwareKey || 'SOFTWARE',
      productTitle: bn.softwareTitle || '新購雙軌產品節點',
      codeLabel: cat?.codeLabel || bn.softwareKey || 'BINARY',
      licenseCode: bn.softwareKey ? `SW-${bn.softwareKey}` : bn.nodeId,
      purchasedAt: undefined,
      isExtraSeat: false,
    });
  });

  return entries;
}
