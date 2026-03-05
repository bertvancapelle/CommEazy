// swift-tools-version:5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "SwiftMail",
    platforms: [
        .macOS("12.0"),
        .iOS("14.0"),
        .tvOS("14.0"),
        .watchOS("7.0"),
        .macCatalyst("14.0")
    ],
    products: [
        .library(
            name: "SwiftMail",
            targets: ["SwiftMail"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-log.git", from: "1.0.0"),
        .package(url: "https://github.com/apple/swift-nio", from: "2.0.0"),
        .package(url: "https://github.com/apple/swift-nio-imap", from: "0.2.0"),
        .package(url: "https://github.com/apple/swift-nio-ssl", from: "2.0.0"),
        .package(url: "https://github.com/apple/swift-collections.git", from: "1.0.0"),
        .package(url: "https://github.com/Cocoanetics/SwiftText.git", branch: "main"),
    ],
    targets: [
        .target(
            name: "SwiftMail",
            dependencies: [
                .product(name: "NIO", package: "swift-nio"),
                .product(name: "NIOSSL", package: "swift-nio-ssl"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "NIOIMAP", package: "swift-nio-imap"),
                .product(name: "OrderedCollections", package: "swift-collections"),
                .product(name: "SwiftTextHTML", package: "swifttext"),
            ]
        ),
    ]
)
