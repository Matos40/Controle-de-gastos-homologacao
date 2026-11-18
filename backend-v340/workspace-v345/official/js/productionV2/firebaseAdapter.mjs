import {doc, getDocFromServer, onSnapshot, runTransaction} from 'firebase/firestore';
import {PRODUCTION_CONFIG, requireProductionConfig} from './config.mjs';
import {canTransfer} from './cleanWorkspace.mjs';
import {openSmartLoginAuth} from './smartLoginOfficialAuth.mjs';
import {commitV2, validateV2Head, validateV2Receipt} from './capacity.mjs';
import {canonical} from './model.mjs';
import {payloadHash} from './initialTransfer.mjs';

export async function openProductionCloud(config = PRODUCTION_CONFIG) {
  requireProductionConfig(config);
  const auth = await openSmartLoginAuth();
  const headRef = uid => doc(auth.db, 'raytechV345Finance', uid, 'banks', 'v2-main');
  const receiptRef = (uid, op) => doc(headRef(uid), 'receipts', op);
  const guard = uid => {
    requireProductionConfig(config);
    auth.assertSession(uid);
    if (!canTransfer(config, location.search)) throw Error('V345_BANK');
  };
  const read = async uid => {
    guard(uid);
    const head = (await getDocFromServer(headRef(uid))).data();
    guard(uid);
    if (!head) return null;
    validateV2Head(head);
    const receipt = validateV2Receipt((await getDocFromServer(receiptRef(uid, head.lastOperationId))).data());
    guard(uid);
    return {head, receipt};
  };
  return {
    currentUid: auth.currentUid, onSession: auth.onSession, signIn: auth.signIn, signOut: auth.signOut,
    async approved(uid) {
      guard(uid);
      const [account, role] = await Promise.all([auth.profile(uid), auth.role(uid)]);
      guard(uid);
      return {writeEnabled: account.blocked === false && (account.plan === 'premium' || !!role)};
    },
    read,
    send(uid, command) {
      guard(uid);
      return commitV2({
        currentUid: auth.currentUid, sha: payloadHash,
        transaction: fn => runTransaction(auth.db, tx => fn({
          getHead: async who => (await tx.get(headRef(who))).data() ?? null,
          getReceipt: async (who, op) => (await tx.get(receiptRef(who, op))).data() ?? null,
          setHead: (who, value) => tx.set(headRef(who), value),
          setReceipt: (who, op, value) => tx.set(receiptRef(who, op), value),
        })),
      }, uid, command);
    },
    async confirm(uid, expected) {
      guard(uid);
      validateV2Receipt(expected);
      const value = (await getDocFromServer(receiptRef(uid, expected.operationId))).data();
      guard(uid);
      return !!value && canonical(value) === canonical(expected);
    },
    watchHead(uid, notify, error) {
      guard(uid);
      return onSnapshot(headRef(uid), snapshot => {
        if (auth.currentUid() === uid && !snapshot.metadata.fromCache) notify(snapshot.data()?.revision ?? 0);
      }, error);
    },
    sha: payloadHash,
  };
}
