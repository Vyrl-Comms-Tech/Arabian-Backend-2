const mongoose = require('mongoose');
const Url=process.env.MongoDbUrl


const ConnectDb= async()=>{
    try{
        await mongoose.connect(Url)
    }catch(err){
        console.log("Database Error",err)
    }
}
module.exports=ConnectDb