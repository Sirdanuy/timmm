import {
  ConnectWallet,
  detectContractFeature,
  useActiveClaimConditionForWallet,
  useAddress,
  useClaimConditions,
  useClaimedNFTSupply,
  useClaimerProofs,
  useClaimIneligibilityReasons,
  useContract,
  useContractMetadata,
  useNFT,
  useUnclaimedNFTSupply,
  Web3Button,
} from "@thirdweb-dev/react";
import { BigNumber, utils } from "ethers";
import { useMemo, useState } from "react";
import { HeadingImage } from "./components/HeadingImage";
import { PoweredBy } from "./components/PoweredBy";
import { useToast } from "./components/ui/use-toast";
import { parseIneligibility } from "./utils/parseIneligibility";
import {
  clientIdConst,
  contractConst,
  primaryColorConst,
  themeConst,
} from "./consts/parameters";


import Peq from './peq.png';

import "./styles.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGlobe } from "@fortawesome/free-solid-svg-icons/faGlobe";
import { faDiscord } from "@fortawesome/free-brands-svg-icons/faDiscord";
import { faTwitter } from "@fortawesome/free-brands-svg-icons/faTwitter";

const urlParams = new URL(window.location.toString()).searchParams;
const contractAddress = urlParams.get("contract") || contractConst || "";
const primaryColor =
  urlParams.get("primaryColor") || primaryColorConst || undefined;

const colors = {
  purple: "#7C3AED",
  blue: "#3B82F6",
  orange: "#F59E0B",
  pink: "#EC4899",
  green: "#10B981",
  red: "#EF4444",
  teal: "#14B8A6",
  cyan: "#22D3EE",
  yellow: "#FBBF24",
} as const;

export default function Home() {
  const contractQuery = useContract(contractAddress);
  const contractMetadata = useContractMetadata(contractQuery.contract);
  const { toast } = useToast();
  let theme = (urlParams.get("theme") || themeConst || "light") as
    | "light"
    | "dark"
    | "system";
  if (theme === "system") {
    theme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  const root = window.document.documentElement;
  root.classList.add(theme);
  const address = useAddress();
  const [quantity, setQuantity] = useState(1);
  const claimConditions = useClaimConditions(contractQuery.contract);
  const activeClaimCondition = useActiveClaimConditionForWallet(
    contractQuery.contract,
    address
  );
  const claimerProofs = useClaimerProofs(contractQuery.contract, address || "");
  const claimIneligibilityReasons = useClaimIneligibilityReasons(
    contractQuery.contract,
    {
      quantity,
      walletAddress: address || "",
    }
  );
  const unclaimedSupply = useUnclaimedNFTSupply(contractQuery.contract);
  const claimedSupply = useClaimedNFTSupply(contractQuery.contract);
  const { data: firstNft, isLoading: firstNftLoading } = useNFT(
    contractQuery.contract,
    0
  );

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    return BigNumber.from(claimedSupply.data || 0)
      .add(BigNumber.from(unclaimedSupply.data || 0))
      .toString();
  }, [claimedSupply.data, unclaimedSupply.data]);

  const priceToMint = useMemo(() => {
    const bnPrice = BigNumber.from(
      activeClaimCondition.data?.currencyMetadata.value || 0
    );
    return `${utils.formatUnits(
      bnPrice.mul(quantity).toString(),
      activeClaimCondition.data?.currencyMetadata.decimals || 18
    )} ${activeClaimCondition.data?.currencyMetadata.symbol}`;
  }, [
    activeClaimCondition.data?.currencyMetadata.decimals,
    activeClaimCondition.data?.currencyMetadata.symbol,
    activeClaimCondition.data?.currencyMetadata.value,
    quantity,
  ]);

  const isOpenEdition = useMemo(() => {
    if (contractQuery?.contract) {
      const contractWrapper = (contractQuery.contract as any).contractWrapper;

      const featureDetected = detectContractFeature(
        contractWrapper,
        "ERC721SharedMetadata"
      );

      return featureDetected;
    }
    return false;
  }, [contractQuery.contract]);

  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition.data?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs.data?.maxClaimable;

    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);
        } catch (e) {
          // fall back to default case
        }
      }
    }

    const maxAvailable = BigNumber.from(unclaimedSupply.data || 0);

    let max;
    if (maxAvailable.lt(bnMaxClaimable) && !isOpenEdition) {
      max = maxAvailable;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
    claimerProofs.data?.maxClaimable,
    unclaimedSupply.data,
    activeClaimCondition.data?.maxClaimableSupply,
    activeClaimCondition.data?.maxClaimablePerWallet,
  ]);

  const isSoldOut = useMemo(() => {
    try {
      return (
        (activeClaimCondition.isSuccess &&
          BigNumber.from(activeClaimCondition.data?.availableSupply || 0).lte(
            0
          )) ||
        (numberClaimed === numberTotal && !isOpenEdition)
      );
    } catch (e) {
      return false;
    }
  }, [
    activeClaimCondition.data?.availableSupply,
    activeClaimCondition.isSuccess,
    numberClaimed,
    numberTotal,
    isOpenEdition,
  ]);

  const canClaim = useMemo(() => {
    return (
      activeClaimCondition.isSuccess &&
      claimIneligibilityReasons.isSuccess &&
      claimIneligibilityReasons.data?.length === 0 &&
      !isSoldOut
    );
  }, [
    activeClaimCondition.isSuccess,
    claimIneligibilityReasons.data?.length,
    claimIneligibilityReasons.isSuccess,
    isSoldOut,
  ]);

  const isLoading = useMemo(() => {
    return (
      activeClaimCondition.isLoading ||
      unclaimedSupply.isLoading ||
      claimedSupply.isLoading ||
      !contractQuery.contract
    );
  }, [
    activeClaimCondition.isLoading,
    contractQuery.contract,
    claimedSupply.isLoading,
    unclaimedSupply.isLoading,
  ]);

  const buttonLoading = useMemo(
    () => isLoading || claimIneligibilityReasons.isLoading,
    [claimIneligibilityReasons.isLoading, isLoading]
  );

  const buttonText = useMemo(() => {
    if (isSoldOut) {
      return "Sold Out";
    }

    if (canClaim) {
      const pricePerToken = BigNumber.from(
        activeClaimCondition.data?.currencyMetadata.value || 0
      );
      if (pricePerToken.eq(0)) {
        return "Mint (Free)";
      }
      return `Mint (${priceToMint})`;
    }
    if (claimIneligibilityReasons.data?.length) {
      return parseIneligibility(claimIneligibilityReasons.data, quantity);
    }
    if (buttonLoading) {
      return "Checking eligibility...";
    }

    return "Minting not available";
  }, [
    isSoldOut,
    canClaim,
    claimIneligibilityReasons.data,
    buttonLoading,
    activeClaimCondition.data?.currencyMetadata.value,
    priceToMint,
    quantity,
  ]);

  const dropNotReady = useMemo(
    () =>
      claimConditions.data?.length === 0 ||
      claimConditions.data?.every((cc) => cc.maxClaimableSupply === "0"),
    [claimConditions.data]
  );

  const dropStartingSoon = useMemo(
    () =>
      (claimConditions.data &&
        claimConditions.data.length > 0 &&
        activeClaimCondition.isError) ||
      (activeClaimCondition.data &&
        activeClaimCondition.data.startTime > new Date()),
    [
      activeClaimCondition.data,
      activeClaimCondition.isError,
      claimConditions.data,
    ]
  );

  const clientId = urlParams.get("clientId") || clientIdConst || "";
  if (!clientId) {
    return (
      <div className="flex items-center justify-center h-full">
        Client ID is required as a query param to use this page.
      </div>
    );
  }

  if (!contractAddress) {
    return (
      <div className="flex items-center justify-center h-full">
        No contract address provided
      </div>
    );
  }

  return (
    // <div className="w-screen min-h-screen md:overflow-hidden">
    <div className="overflow-hidden">
      <div className="w-16 h-36 2xl:w-28 2xl:top-8 2xl:h-48 relative top-8 2xl:left-36 left-5 lg:top-14 lg:left-16">
        <img className="rounded-full" src={Peq} alt="image loading pls wait" />
      </div>
      <ConnectWallet
        className="!absolute lg:!right-14 2xl:!right-28 !right-3 !top-10"
        theme={theme}
      />

      <div className="gif lg:w-[90%] mt-3 w-[96%] left-2 2xl:h-[86pc] lg:h-[47pc] lg:flex relative lg:left-[5%] lg:mt-0 rounded-md">
        <div className="lg:left-[7%] left-8 top-16 relative">
          <div className="lg:w-[55%] md:w-[86%] w-80 lg:text-base text-md">
            <h1 className="text-red-700 2xl:text-6xl lg:ml-0 lg:text-4xl -ml-3 text-3xl relative lg:top-0 -top-8">
              Base Minting Dapp
            </h1>

            <div className="relative top-[31.2pc] md:top-[22pc] lg:top-0">
            {/* <p className="text-red-600 text-[9px] lg:text-[10px] 2xl:text-xl">Powered By Webberland</p> */}
              <div className="space-x-4 xl:space-x-7 mt-5 mb-2">
                <a href="https://example.com" className="text-white">
                  <FontAwesomeIcon
                    className="lg:text-2xl text-2xl 2xl:text-4xl"
                    icon={faGlobe}
                  />
                </a>
                <a href="https://x.com" className="text-white">
                  <FontAwesomeIcon
                    className="lg:text-2xl text-2xl 2xl:text-4xl"
                    icon={faTwitter}
                  />
                </a>
                <a href="https://discord.com" className="text-white">
                  <FontAwesomeIcon
                    className="lg:text-2xl text-2xl 2xl:text-4xl"
                    icon={faDiscord}
                  />
                </a>
              </div>

              <p className="text-white 2xl:text-3xl">
               Lorem ipsum dolor sit, amet consectetur adipisicing elit.  Est itaque doloribus delectus deserunt illum quos ratione, aspernatur temporibus sequi, reiciendis dolorum amet porro praesentium natus, architecto harum maxime eum velit iure quod veniam a excepturi? Ab laborum, magni esse ad et, sunt sed quae maxime provident quisquam molestiae. Commodi aliquam quas eum ullam sint reiciendis esse, quaerat itaque iusto? Doloribus deleniti corporis provident doloremque, fuga temporibus dicta nostrum, ab nesciunt, incidunt repellendus labore repellat nam in quis. Labore.
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:h-screen bottom-[33pc] md:bottom-[13pc]  lg:bottom-0 lg:pt-32 w-[128%] right-20 lg:w-96 relative lg:right-[20%]">
          <div className="items-center justify-center hidden md:w-[140%] md:h-96 2xl:w-[250%] 2xl:h-[100%] 2xl:top-28 lg:ml-14 lg:w-[118%] lg:h-72 lg:mb-1.5 h-full lg:col-span-5 lg:flex lg:px-12">
            <HeadingImage
              src={Peq}
              isLoading={isLoading}
            />
          </div>

          <div className="flex items-center justify-center lg:w-[103%] lg:mt-9 ml-12 h-full col-span-1 lg:col-span-7">
            <div className="flex flex-col w-full max-w-xl gap-4 2xl:w-[100%] 2xl:h-[200%]  p-12 rounded-xl ">
              <div className="flex w-full mt-8 xs:mb-8 xs:mt-0 md:w-[36%] md:h-[40%] lg:hidden">
                <HeadingImage
                  src={Peq}
                  isLoading={isLoading}
                />
              </div>

              <div className="flex flex-col gap-2 xs:gap-4 ">
                {/* {isLoading ? (
                  <div
                    role="status"
                    className="space-y-8 animate-pulse lg:flex lg:items-center lg:space-x-8 lg:space-y-0"
                  >
                    <div className="w-full">
                      <div className="w-24 h-10 bg-gray-200 rounded-full dark:bg-gray-700"></div>
                    </div>
                  </div>
                ) : isOpenEdition ? null : (
                  <p>
                    <span className="text-lg font-bold tracking-wider text-gray-500 xs:text-xl lg:text-2xl">
                      {numberClaimed}
                    </span>{" "}
                    <span className="text-lg font-bold tracking-wider xs:text-xl lg:text-2xl">
                      / {numberTotal} minted
                    </span>
                  </p>
                )} */}
                <h1 className="text-2xl font-bold line-clamp-1 xs:text-3xl lg:text-4xl">
                  {/* {contractMetadata.isLoading ? (
                    <div
                      role="status"
                      className="space-y-8 animate-pulse lg:flex lg:items-center lg:space-x-8 lg:space-y-0"
                    >
                      <div className="w-full">
                        <div className="w-48 h-8 bg-gray-200 rounded-full dark:bg-gray-700"></div>
                      </div>
                      <span className="sr-only">Loading...</span>
                    </div>
                  ) : (
                    contractMetadata.data?.name
                  )} */}
                </h1>
                {/* {contractMetadata.data?.description ||
                contractMetadata.isLoading ? (
                  <div className="text-gray-500 line-clamp-2">
                    {contractMetadata.isLoading ? (
                      <div
                        role="status"
                        className="space-y-8 animate-pulse lg:flex lg:items-center lg:space-x-8 lg:space-y-0"
                      >
                        <div className="w-full">
                          <div className="mb-2.5 h-2 max-w-[480px] rounded-full bg-gray-200 dark:bg-gray-700"></div>
                          <div className="mb-2.5 h-2 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                        </div>
                        <span className="sr-only">Loading...</span>
                      </div>
                    ) : (
                      contractMetadata.data?.description
                    )}
                  </div>
                ) : null} */}
              </div>
              <div className="flex w-full gap-4">
                {dropNotReady ? (
                  <span className="text-red-500">
                    This drop is not ready to be minted yet. (No claim condition
                    set)
                  </span>
                ) : dropStartingSoon ? (
                  <span className="text-gray-500">
                    Drop is starting soon. Please check back later.
                  </span>
                ) : (
                  <div className="flex flex-col w-full gap-4 lg:ml-3">
                    <div className="flex flex-col w-full gap-4 lg:flex-row lg:items-center lg:gap-4 ">
                        <div className="flex">
                        <div >
                          <h3 className="text-blue-400 flex lg:w-36 w-48 mt-2">Price: &nbsp; <span className="text-white"> 0 ETH</span></h3>
                        </div>
                      <div className="flex w-full px-2 border lg:space-x-3 border-gray-400 rounded-md h-11 dark:border-gray-800 lg:w-full">
                        <button
                          onClick={() => {
                            const value = quantity - 1;
                            if (value > maxClaimable) {
                              setQuantity(maxClaimable);
                            } else if (value < 1) {
                              setQuantity(1);
                            } else {
                              setQuantity(value);
                            }
                          }}
                          className="flex items-center  justify-center h-full px-2 text-2xl text-center rounded-l-md disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white dark:disabled:text-gray-600"
                          disabled={isSoldOut || quantity - 1 < 1}
                        >
                          -
                        </button>
                        <p className="flex items-center justify-center w-full h-full font-mono text-center dark:text-white lg:w-full">
                          {!isLoading && isSoldOut ? "Sold Out" : quantity}
                        </p>
                        <button
                          onClick={() => {
                            const value = quantity + 1;
                            if (value > maxClaimable) {
                              setQuantity(maxClaimable);
                            } else if (value < 1) {
                              setQuantity(1);
                            } else {
                              setQuantity(value);
                            }
                          }}
                          className={
                            "flex h-full items-center justify-center rounded-r-md px-2 text-center text-2xl disabled:cursor-not-allowed disabled:text-gray-500 dark:text-white dark:disabled:text-gray-600"
                          }
                          disabled={isSoldOut || quantity + 1 > maxClaimable}
                        >
                          +
                        </button>
                      </div>
                        </div>
                      <Web3Button
                        contractAddress={
                          contractQuery.contract?.getAddress() || ""
                        }
                        style={{
                          backgroundColor:
                            colors[primaryColor as keyof typeof colors] ||
                            primaryColor,
                          maxHeight: "43px",
                        }}
                        theme={theme}
                        action={(cntr) => cntr.erc721.claim(quantity)}
                        isDisabled={!canClaim || buttonLoading}
                        onError={(err) => {
                          console.error(err);
                          console.log({ err });
                          toast({
                            title: "Failed to mint drop",
                            description: (err as any).reason || "",
                            duration: 9000,
                            variant: "destructive",
                          });
                        }}
                        onSuccess={() => {
                          toast({
                            title: "Successfully minted",
                            description:
                              "The NFT has been transferred to your wallet",
                            duration: 5000,
                            className: "bg-green-500",
                          });
                        }}
                      >
                        {buttonLoading ? (
                          <div role="status">
                            <svg
                              aria-hidden="true"
                              className="w-4 h-4 mr-2 text-gray-200 animate-spin fill-blue-600 dark:text-gray-600"
                              viewBox="0 0 100 101"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                fill="currentColor"
                              />
                              <path
                                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                fill="currentFill"
                              />
                            </svg>
                            <span className="sr-only">Loading...</span>
                          </div>
                        ) : (
                          buttonText
                        )}
                      </Web3Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <PoweredBy /> */}
    </div>
  );
}
