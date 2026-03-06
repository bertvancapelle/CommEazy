/**
 * MailModule.m — React Native Bridge for Mail (IMAP/SMTP)
 *
 * Objective-C bridge macros for exposing Swift MailModule to React Native.
 * Uses RCT_EXTERN_MODULE and RCT_EXTERN_METHOD to bridge Swift async methods.
 *
 * @see MailModule.swift for Swift implementation
 * @see .claude/plans/MAIL_MODULE_PROMPT.md - Fase 3
 */

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

// ============================================================
// MARK: - Module Bridge
// ============================================================

@interface RCT_EXTERN_MODULE(MailModule, RCTEventEmitter)

// ============================================================
// MARK: - IMAP: Connection
// ============================================================

RCT_EXTERN_METHOD(connectIMAP:(NSString *)host
                  port:(NSInteger)port
                  username:(NSString *)username
                  password:(NSString *)password
                  accessToken:(NSString *)accessToken
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(testConnection:(NSString *)imapHost
                  imapPort:(NSInteger)imapPort
                  smtpHost:(NSString *)smtpHost
                  smtpPort:(NSInteger)smtpPort
                  username:(NSString *)username
                  password:(NSString *)password
                  accessToken:(NSString *)accessToken
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - IMAP: Mailbox Operations
// ============================================================

RCT_EXTERN_METHOD(listMailboxes:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - IMAP: Message Operations
// ============================================================

RCT_EXTERN_METHOD(fetchHeaders:(NSString *)folderName
                  limit:(NSInteger)limit
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchMessageBody:(NSInteger)uid
                  folderName:(NSString *)folderName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchAttachmentData:(NSInteger)uid
                  folderName:(NSString *)folderName
                  partIndex:(NSInteger)partIndex
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(searchMessages:(NSString *)folderName
                  query:(NSString *)query
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(fetchHeadersByUIDs:(NSString *)folderName
                  uids:(NSArray *)uids
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - IMAP: Flag Operations
// ============================================================

RCT_EXTERN_METHOD(markAsRead:(NSInteger)uid
                  folderName:(NSString *)folderName
                  read:(BOOL)read
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(markAsFlagged:(NSInteger)uid
                  folderName:(NSString *)folderName
                  flagged:(BOOL)flagged
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(deleteMessage:(NSInteger)uid
                  folderName:(NSString *)folderName
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(moveMessage:(NSInteger)uid
                  fromFolder:(NSString *)fromFolder
                  toFolder:(NSString *)toFolder
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

// ============================================================
// MARK: - SMTP: Send
// ============================================================

RCT_EXTERN_METHOD(sendMessage:(NSString *)smtpHost
                  smtpPort:(NSInteger)smtpPort
                  username:(NSString *)username
                  password:(NSString *)password
                  accessToken:(NSString *)accessToken
                  from:(NSDictionary *)from
                  to:(NSArray *)to
                  cc:(NSArray *)cc
                  bcc:(NSArray *)bcc
                  subject:(NSString *)subject
                  body:(NSString *)body
                  htmlBody:(NSString *)htmlBody
                  attachments:(NSArray *)attachments
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
