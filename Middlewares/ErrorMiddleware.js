const ErrorMiddleware=async(err,req,res,next)=>{
    const error=err||"internal server error"
    return res.status(400).json({
        success:false,
        error:error.message,
        message:"Error from Error Midd Something went wrong"
    })
    console.log(error)
}
module.exports=ErrorMiddleware